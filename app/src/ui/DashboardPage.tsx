import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { supabase } from '../core/supabase'
import type { Dashboard } from '../core/types'

// 1단계 확인용 화면: 로그인 → app_dashboards 조회까지 연결되는지만 본다.
// 다음 단계에서 이 자리에 위젯 그리드가 들어간다.
export function DashboardPage({ session }: { session: Session }) {
  const [dashboards, setDashboards] = useState<Dashboard[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('app_dashboards')
      .select('*')
      .order('created_at')
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setDashboards(data as Dashboard[])
      })
  }, [])

  return (
    <div className="page">
      <header className="panel row" style={{ justifyContent: 'space-between' }}>
        <div>
          <strong>My Dashboard</strong>
          <div className="muted">{session.user.email}</div>
        </div>
        <button className="btn ghost" onClick={() => supabase.auth.signOut()}>로그아웃</button>
      </header>

      <section className="panel">
        {error && <p className="error">DB 연결 오류: {error}</p>}
        {!error && dashboards === null && <p className="muted">불러오는 중…</p>}
        {dashboards && (
          <p style={{ margin: 0 }}>
            DB 연결 확인 완료 · 대시보드 {dashboards.length}개 (아직 위젯은 없어요)
          </p>
        )}
      </section>
    </div>
  )
}
