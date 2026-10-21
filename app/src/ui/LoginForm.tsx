import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../core/supabase'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  async function onLogin(e: FormEvent) {
    e.preventDefault()
    setMessage('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setMessage('로그인하지 못했어요. 이메일과 비밀번호를 확인해 주세요.')
  }

  async function onSignUp() {
    setMessage('')
    if (!email.trim() || password.length < 6) {
      setMessage('이메일과 6자 이상 비밀번호를 입력해 주세요.')
      return
    }
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
    if (error) setMessage(error.message)
    else if (!data.session) setMessage('가입 확인 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해 주세요.')
  }

  return (
    <section className="panel center">
      <form className="stack" onSubmit={onLogin}>
        <h1 style={{ margin: 0, fontSize: 22 }}>My Dashboard</h1>
        <p className="muted" style={{ margin: 0 }}>내 데이터는 로그인한 나만 볼 수 있어요.</p>
        <input
          type="email"
          placeholder="이메일"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="비밀번호 (6자 이상)"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <div className="row">
          <button className="btn" type="submit">로그인</button>
          <button className="btn ghost" type="button" onClick={onSignUp}>가입</button>
        </div>
        {message && <p className="error" role="status">{message}</p>}
      </form>
    </section>
  )
}
