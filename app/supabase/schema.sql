-- 개인화 대시보드 서비스용 테이블 (기존 dashboard_state와 별개)
-- Supabase SQL Editor에 통째로 붙여 넣어 실행하세요. 여러 번 실행해도 안전합니다.

-- 1) updated_at 자동 갱신 함수
create or replace function public.app_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2) 대시보드: 사용자 한 명이 여러 개 가질 수 있음
create table if not exists public.app_dashboards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null default '내 대시보드',
  template_id text,                       -- 어떤 템플릿으로 만들었는지 (없으면 빈 대시보드)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 3) 위젯: 대시보드 안의 위젯 하나 = 한 행
create table if not exists public.app_widgets (
  id           uuid primary key default gen_random_uuid(),
  dashboard_id uuid not null references public.app_dashboards(id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type         text not null,                       -- 'todo', 'habit', 'grass', 'table', 'pie', 'calendar' ...
  config       jsonb not null default '{}'::jsonb,  -- 제목, 색, 열 정의 등 위젯 설정
  data         jsonb not null default '{}'::jsonb,  -- 위젯 안의 실제 내용
  layout       jsonb not null default '{}'::jsonb,  -- 화면 크기별 위치·크기: {"lg":{"x":0,"y":0,"w":4,"h":3},"sm":{...}}
  status       text not null default 'active'       -- 'active' 화면에 보임 / 'archived' 보관함 (migrations/20261021_widget_archive.sql)
               constraint app_widgets_status_check check (status in ('active', 'archived')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists app_dashboards_user_idx on public.app_dashboards(user_id);
create index if not exists app_widgets_dashboard_idx on public.app_widgets(dashboard_id);
create index if not exists app_widgets_user_idx on public.app_widgets(user_id);
create index if not exists app_widgets_dashboard_status_idx on public.app_widgets(dashboard_id, status);

-- 4) updated_at 트리거
drop trigger if exists app_dashboards_updated_at on public.app_dashboards;
create trigger app_dashboards_updated_at
  before update on public.app_dashboards
  for each row execute function public.app_set_updated_at();

drop trigger if exists app_widgets_updated_at on public.app_widgets;
create trigger app_widgets_updated_at
  before update on public.app_widgets
  for each row execute function public.app_set_updated_at();

-- 5) RLS: 본인 행만 접근
alter table public.app_dashboards enable row level security;
alter table public.app_widgets    enable row level security;

drop policy if exists "dashboards select own" on public.app_dashboards;
drop policy if exists "dashboards insert own" on public.app_dashboards;
drop policy if exists "dashboards update own" on public.app_dashboards;
drop policy if exists "dashboards delete own" on public.app_dashboards;

create policy "dashboards select own" on public.app_dashboards
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "dashboards insert own" on public.app_dashboards
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "dashboards update own" on public.app_dashboards
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "dashboards delete own" on public.app_dashboards
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "widgets select own" on public.app_widgets;
drop policy if exists "widgets insert own" on public.app_widgets;
drop policy if exists "widgets update own" on public.app_widgets;
drop policy if exists "widgets delete own" on public.app_widgets;

create policy "widgets select own" on public.app_widgets
  for select to authenticated using ((select auth.uid()) = user_id);

-- 위젯을 넣을 때, 지정한 대시보드가 내 것인지도 함께 확인 (남의 대시보드에 위젯을 꽂는 것 방지)
create policy "widgets insert own" on public.app_widgets
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.app_dashboards d
      where d.id = dashboard_id and d.user_id = (select auth.uid())
    )
  );

create policy "widgets update own" on public.app_widgets
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.app_dashboards d
      where d.id = dashboard_id and d.user_id = (select auth.uid())
    )
  );

create policy "widgets delete own" on public.app_widgets
  for delete to authenticated using ((select auth.uid()) = user_id);

-- 6) 위젯 프리셋 (migrations/20261022_presets.sql 과 같은 내용)
--    app_presets: 시스템 프리셋(owner_id NULL, 읽기 전용) + 사용자 프리셋(본인만). 구조만 담고 기록(data)은 담지 않는다.
--    app_apply_preset: 기존 위젯 보관(선택) + 새 위젯 추가를 한 트랜잭션으로. 삭제 없음, security invoker.
-- 1) 테이블
create table if not exists public.app_presets (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid references auth.users(id) on delete cascade,  -- NULL = 시스템 프리셋. 기본값을 auth.uid()로 두지 않는다.
  name        text not null,
  description text not null default '',
  layout      jsonb not null default '[]'::jsonb
              constraint app_presets_layout_array check (jsonb_typeof(layout) = 'array'),
  created_at  timestamptz not null default now(),
  -- 프리셋에는 구조만 담는다. 항목 안에 data(기록) 키가 있으면 거부한다.
  constraint app_presets_layout_no_data check (not (layout @? '$[*].data'))
);

create index if not exists app_presets_owner_idx on public.app_presets(owner_id);

-- 2) RLS
alter table public.app_presets enable row level security;

drop policy if exists "presets select system or own" on public.app_presets;
drop policy if exists "presets update own" on public.app_presets;
drop policy if exists "presets delete own" on public.app_presets;

create policy "presets select system or own" on public.app_presets
  for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()));

create policy "presets update own" on public.app_presets
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "presets delete own" on public.app_presets
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- 3) 프리셋 적용 함수
--    p_widgets: [{"type": "...", "config": {...}, "data": {...}, "layout": {...}}, ...]
--    (data는 앱이 위젯 종류별 기본값으로 채워서 보낸다. 프리셋 원본의 data는 읽지 않는다.)
create or replace function public.app_apply_preset(
  p_dashboard_id     uuid,
  p_archive_existing boolean,
  p_widgets          jsonb
)
returns setof public.app_widgets
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- 내 대시보드인지 확인
  if not exists (
    select 1 from public.app_dashboards d
    where d.id = p_dashboard_id and d.user_id = (select auth.uid())
  ) then
    raise exception 'dashboard not found' using errcode = '42501';
  end if;

  if p_widgets is null
     or jsonb_typeof(p_widgets) <> 'array'
     or jsonb_array_length(p_widgets) = 0
     or jsonb_array_length(p_widgets) > 50 then
    raise exception 'p_widgets must be a non-empty array (max 50)' using errcode = '22023';
  end if;

  -- 기존 위젯 보관: status만 바꾼다. config/data/layout은 그대로.
  if p_archive_existing then
    update public.app_widgets
       set status = 'archived'
     where dashboard_id = p_dashboard_id and status = 'active';
  end if;

  -- 새 위젯 추가 (user_id는 기본값 auth.uid(), RLS가 다시 확인한다)
  return query
  with ins as (
    insert into public.app_widgets (dashboard_id, type, config, data, layout)
    select p_dashboard_id,
           e ->> 'type',
           coalesce(e -> 'config', '{}'::jsonb),
           coalesce(e -> 'data', '{}'::jsonb),
           coalesce(e -> 'layout', '{}'::jsonb)
      from jsonb_array_elements(p_widgets) with ordinality as t(e, ord)
     order by ord
    returning *
  )
  select * from ins;
end;
$$;

revoke all on function public.app_apply_preset(uuid, boolean, jsonb) from public, anon;
grant execute on function public.app_apply_preset(uuid, boolean, jsonb) to authenticated;

-- 4) 시스템 프리셋 시드 (owner_id = NULL). 구조만: type / title / config / 위치·크기(lg 12칸).
insert into public.app_presets (id, owner_id, name, description, layout, created_at) values
(
  '00000000-0000-4000-8000-0000000000a1', null,
  '취업 준비',
  '지원 마감, 준비 목표, 자격·스펙, 오늘 할 일을 한 화면에서 관리해요.',
  $preset$[
    {"type":"dday",   "title":"지원 마감 D-day",  "config":{},                           "x":0, "y":0,  "w":4,  "h":6},
    {"type":"goals",  "title":"지원 준비 목표",   "config":{},                           "x":4, "y":0,  "w":4,  "h":6},
    {"type":"links",  "title":"채용 사이트",      "config":{},                           "x":8, "y":0,  "w":4,  "h":6},
    {"type":"todo",   "title":"오늘 할 일",       "config":{},                           "x":0, "y":6,  "w":4,  "h":10},
    {"type":"status", "title":"자격 · 스펙",      "config":{},                           "x":4, "y":6,  "w":4,  "h":10},
    {"type":"timer",  "title":"면접·공부 타이머", "config":{"focusMin":25,"breakMin":5}, "x":8, "y":6,  "w":4,  "h":10},
    {"type":"note",   "title":"면접 준비 메모",   "config":{},                           "x":0, "y":16, "w":12, "h":6}
  ]$preset$::jsonb,
  now()
),
(
  '00000000-0000-4000-8000-0000000000a2', null,
  '공부·학습',
  '공부 시간 기록, 시험 D-day, 학기 목표, 학습량 추이를 관리해요.',
  $preset$[
    {"type":"timer", "title":"공부 타이머",      "config":{"focusMin":50,"breakMin":10}, "x":0, "y":0,  "w":4,  "h":10},
    {"type":"todo",  "title":"오늘 공부할 일",   "config":{},                            "x":4, "y":0,  "w":4,  "h":10},
    {"type":"dday",  "title":"시험 D-day",       "config":{},                            "x":8, "y":0,  "w":4,  "h":5},
    {"type":"goals", "title":"학기 목표",        "config":{},                            "x":8, "y":5,  "w":4,  "h":5},
    {"type":"chart", "title":"주간 학습 시간",   "config":{"kind":"line"},               "x":0, "y":10, "w":8,  "h":9},
    {"type":"pie",   "title":"과목별 공부 비율", "config":{},                            "x":8, "y":10, "w":4,  "h":9},
    {"type":"grass", "title":"학습 잔디",        "config":{},                            "x":0, "y":19, "w":12, "h":5}
  ]$preset$::jsonb,
  now() + interval '1 second'
),
(
  '00000000-0000-4000-8000-0000000000a3', null,
  '습관·루틴',
  '매일의 습관을 체크하고, 꾸준함을 잔디와 그래프로 확인해요.',
  $preset$[
    {"type":"habit",   "title":"습관 트래커", "config":{},                       "x":0, "y":0, "w":8, "h":9},
    {"type":"counter", "title":"물 마시기",   "config":{"step":1,"unit":"잔"},    "x":8, "y":0, "w":4, "h":4},
    {"type":"note",    "title":"오늘의 한 줄","config":{},                       "x":8, "y":4, "w":4, "h":5},
    {"type":"grass",   "title":"루틴 잔디",   "config":{},                       "x":0, "y":9, "w":6, "h":7},
    {"type":"chart",   "title":"주간 컨디션", "config":{"kind":"line"},           "x":6, "y":9, "w":6, "h":7}
  ]$preset$::jsonb,
  now() + interval '2 seconds'
)
on conflict (id) do nothing;

-- 7) 확인용: 실행 후 아래를 돌려 정책 8개가 보이면 성공
-- select tablename, policyname, cmd from pg_policies
-- where tablename in ('app_dashboards','app_widgets') order by tablename, cmd;
-- 프리셋 확인: migrations/20261022_presets.sql 맨 아래의 확인 쿼리 참고
-- (시스템 프리셋 3개, app_presets 정책 3개: select/update/delete)
