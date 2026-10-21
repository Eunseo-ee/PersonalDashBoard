-- =====================================================================
-- 마이그레이션: 위젯 프리셋(시스템 프리셋 + 적용 함수)
-- 작성일: 2026-10-22
-- 대상: 새 테이블 public.app_presets, 새 함수 public.app_apply_preset
--       (기존 app_dashboards / app_widgets 구조와 기존 정책은 바꾸지 않음)
-- 실행: Supabase SQL Editor에 통째로 붙여 넣어 실행. 여러 번 실행해도 안전함.
--       먼저 20261021_widget_archive.sql(status 컬럼)이 적용되어 있어야 한다.
--
-- [바뀌는 것]
--   1) app_presets 테이블: 위젯 구성(구조)을 담는 템플릿.
--        owner_id  NULL  = 시스템 프리셋 (모두가 읽기만 가능)
--        owner_id  값    = 사용자 프리셋 (본인만 읽기/수정/삭제) ← 3단계에서 사용. 이번에는 저장 기능 없음.
--        layout(jsonb)   = 위젯 목록 배열. 항목: {type, title, config, x, y, w, h}
--                          x/y/w/h는 넓은 화면(lg, 12칸) 기준. 중간/좁은 화면 배치는 앱이 적용할 때 계산한다.
--                          기록 데이터(data)는 담지 않는다. (CHECK 제약으로 data 키가 있으면 저장 거부)
--   2) RLS: 시스템 프리셋은 로그인한 누구나 SELECT만. 사용자 프리셋은 본인 것만 SELECT/UPDATE/DELETE.
--      INSERT 정책은 아직 만들지 않는다 → 지금은 아무도 앱에서 프리셋을 새로 만들 수 없다.
--      (3단계에서 "owner_id = auth.uid()" INSERT 정책을 추가한다.)
--   3) 함수 app_apply_preset(대시보드, 기존 위젯 보관 여부, 새 위젯 목록):
--        - 한 트랜잭션에서 (선택) 지금 active인 위젯을 archived로 바꾸고, 새 위젯을 insert한다.
--          중간에 실패하면 전부 취소되어 반쯤 적용된 상태가 남지 않는다.
--        - DELETE 구문 없음. 기존 위젯의 config/data/layout은 건드리지 않는다. (status만 변경)
--        - security invoker: 호출한 사용자의 권한으로 실행되므로 기존 RLS가 그대로 적용된다.
--        - 대상 대시보드가 본인 것인지 함수 안에서도 확인한다.
--   4) 시스템 프리셋 3개 시드: 취업 준비 / 공부·학습 / 습관·루틴 (이미 있으면 건드리지 않음)
--
-- [데이터 삭제 관련]
--   - 이 파일은 어떤 행도 지우지 않는다. (DELETE / TRUNCATE / DROP TABLE 없음. 되돌리기 안내의 DROP은 주석)
--   - 프리셋으로 만든 위젯은 프리셋의 복사본이다. 이후 위젯을 바꿔도 프리셋은 바뀌지 않는다.
--
-- [되돌리기가 필요하면]  (앱에서 프리셋 버튼이 에러를 내게 되지만 위젯/기록은 그대로 남는다)
--   drop function if exists public.app_apply_preset(uuid, boolean, jsonb);
--   drop table if exists public.app_presets;
--   (프리셋으로 이미 만들어진 위젯은 app_widgets에 독립적으로 남아 있으므로 영향 없음)
-- =====================================================================

begin;

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

commit;

-- ---------------------------------------------------------------------
-- 확인 쿼리 (선택, 하나씩 실행)
-- ---------------------------------------------------------------------
-- 1) 시스템 프리셋 3개가 들어갔는지: 3행 (취업 준비 / 공부·학습 / 습관·루틴), 위젯 수 7 / 7 / 5
-- select name, owner_id, jsonb_array_length(layout) as widget_count
-- from public.app_presets where owner_id is null order by created_at;
--
-- 2) 프리셋 정책 3개(select / update / delete)가 있는지. insert 정책은 일부러 없다.
-- select policyname, cmd, roles, qual, with_check from pg_policies where tablename = 'app_presets' order by cmd;
--
-- 3) RLS가 켜져 있는지: relrowsecurity = true
-- select relname, relrowsecurity from pg_class where oid = 'public.app_presets'::regclass;
--
-- 4) 적용 함수가 security invoker인지: prosecdef = false 여야 한다 (true면 definer)
-- select proname, prosecdef from pg_proc where proname = 'app_apply_preset';
--
-- 5) 프리셋 layout에 data 키가 없는지: 0행이어야 한다.
-- select name from public.app_presets where layout @? '$[*].data';
