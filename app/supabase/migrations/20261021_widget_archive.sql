-- =====================================================================
-- 마이그레이션: 위젯 "보관"과 "삭제" 분리
-- 작성일: 2026-10-21
-- 대상: public.app_widgets  (기존 index.html이 쓰는 dashboard_state 테이블은 건드리지 않음)
-- 실행: Supabase SQL Editor에 통째로 붙여 넣어 실행. 여러 번 실행해도 안전함.
--
-- [바뀌는 것]
--   1) app_widgets에 status 컬럼 추가: 'active'(화면에 보임) | 'archived'(보관함)
--      - NOT NULL + 기본값 'active'로 추가하므로, 이미 있는 위젯은 전부 자동으로 'active'가 된다.
--        → 마이그레이션 직후 화면은 지금과 똑같다.
--   2) CHECK 제약: status에는 'active'/'archived'만 들어갈 수 있다.
--   3) 인덱스 (dashboard_id, status): 대시보드별 active/archived 목록 조회용.
--
-- [데이터 삭제 관련 — 꼭 읽어 주세요]
--   - 이 파일은 어떤 행도 지우지 않는다. (DELETE / TRUNCATE / DROP TABLE 없음)
--   - 위젯의 기록 데이터(할 일 목록, 습관 체크, 타이머 기록 등)는 별도 테이블이 아니라
--     같은 행의 app_widgets.data(jsonb) 컬럼에 저장되어 있다. 그래서
--       · 보관 = status만 'archived'로 바꾼다 → config / data / layout이 그대로 남는다.
--       · 삭제 = 행을 DELETE한다          → 그 위젯의 config / data / layout이 함께 영구 삭제된다.
--   - 기록을 담는 별도 테이블이 없으므로 외래키 / ON DELETE CASCADE 추가는 필요 없다.
--     (맨 아래 확인 쿼리 B로 "app_widgets를 참조하는 테이블이 정말 없는지" 확인할 수 있다.)
--   - 기존 외래키는 바꾸지 않는다:
--       app_widgets.dashboard_id → app_dashboards(id) ON DELETE CASCADE
--       app_widgets.user_id      → auth.users(id)     ON DELETE CASCADE
--
-- [RLS]
--   - 보관/복원 = UPDATE, 완전 삭제 = DELETE.
--     기존 정책 "widgets update own" / "widgets delete own"이 이미 auth.uid() = user_id인 행만 허용하므로
--     본인 위젯만 보관·복원·삭제할 수 있다. 정책은 바꾸지 않는다. (확인 쿼리 A)
--
-- [되돌리기가 필요하면]
--   alter table public.app_widgets drop column if exists status;
--   (보관 중이던 위젯이 다시 화면에 나타난다. 데이터는 사라지지 않는다.)
-- =====================================================================

begin;

alter table public.app_widgets
  add column if not exists status text not null default 'active';

alter table public.app_widgets drop constraint if exists app_widgets_status_check;
alter table public.app_widgets
  add constraint app_widgets_status_check check (status in ('active', 'archived'));

create index if not exists app_widgets_dashboard_status_idx on public.app_widgets(dashboard_id, status);

commit;

-- ---------------------------------------------------------------------
-- 확인 쿼리 (선택, 하나씩 실행)
-- ---------------------------------------------------------------------
-- 0) 기존 위젯이 모두 active인지: archived가 0이어야 한다.
-- select status, count(*) from public.app_widgets group by status;
--
-- A) 위젯 정책 4개(select/insert/update/delete)가 그대로 있는지
-- select policyname, cmd, qual, with_check from pg_policies where tablename = 'app_widgets' order by cmd;
--
-- B) app_widgets를 외래키로 참조하는 테이블 목록: 결과가 비어 있어야 정상.
--    (행이 나오면 별도 기록 테이블이 있다는 뜻이니 실행을 멈추고 알려 주세요. confdeltype 'c' = CASCADE)
-- select conrelid::regclass as table_name, conname, confdeltype
-- from pg_constraint where contype = 'f' and confrelid = 'public.app_widgets'::regclass;
