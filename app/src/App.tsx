import { useSession } from './core/useSession'
import { DashboardPage } from './ui/DashboardPage'
import { LoginForm } from './ui/LoginForm'

export default function App() {
  const session = useSession()

  if (session === undefined) return <p className="muted" style={{ textAlign: 'center', marginTop: 60 }}>불러오는 중…</p>
  if (session === null) return <LoginForm />
  return <DashboardPage session={session} />
}
