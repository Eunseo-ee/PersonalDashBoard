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
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists app_dashboards_user_idx on public.app_dashboards(user_id);
create index if not exists app_widgets_dashboard_idx on public.app_widgets(dashboard_id);
create index if not exists app_widgets_user_idx on public.app_widgets(user_id);

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

-- 6) 확인용: 실행 후 아래를 돌려 정책 8개가 보이면 성공
-- select tablename, policyname, cmd from pg_policies
-- where tablename in ('app_dashboards','app_widgets') order by tablename, cmd;
