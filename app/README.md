# My Dashboard (app)

위젯을 자유롭게 배치하는 개인화 대시보드 서비스.

## 실행

```bash
cd app
npm install
npm run dev      # 개발 서버
npm run build    # 배포용 빌드 (타입 검사 포함)
```

## 구조

- `src/core` — Supabase 연결, 타입, 로그인 상태. UI에 의존하지 않게 유지 (앱 전환 대비)
- `src/widgets` — 위젯 종류별 폴더와 `registry.ts` (위젯 등록소)
- `src/ui` — 화면 컴포넌트
- `supabase/schema.sql` — DB 테이블과 RLS 정책 (Supabase SQL Editor에서 실행)

## 배포

저장소 루트의 `.github/workflows/deploy.yml` 이 `main` push 시 빌드해서 `/app/` 경로로 배포한다.
