import { useState } from 'react'
import type { FormEvent } from 'react'
import type { WidgetProps } from '../types'

interface Link {
  id: string
  title: string
  url: string
}

/** http/https만 허용한다. javascript: 같은 다른 형식의 주소는 막는다. */
function safeUrl(raw: string): string | null {
  const v = raw.trim()
  if (!v) return null
  let candidate = v
  if (!/^https?:\/\//i.test(v)) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return null
    candidate = `https://${v}`
  }
  try {
    return new URL(candidate).href
  } catch {
    return null
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function LinksWidget({ data, onChange, adding }: WidgetProps) {
  const links = (data.links as Link[] | undefined) ?? []
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')

  const save = (next: Link[]) => onChange({ data: { ...data, links: next } })

  function add(e: FormEvent) {
    e.preventDefault()
    const href = safeUrl(url)
    if (!href) {
      setError('주소를 확인해 주세요. (예: github.com)')
      return
    }
    setError('')
    save([...links, { id: crypto.randomUUID(), title: title.trim() || hostOf(href), url: href }])
    setTitle('')
    setUrl('')
  }

  return (
    <div className="links">
      <ul className="links-list">
        {links.map((l) => (
          <li key={l.id} className="links-item">
            <a href={l.url} target="_blank" rel="noopener noreferrer">
              {l.title}
              <span className="muted links-host"> · {hostOf(l.url)}</span>
            </a>
            <button type="button" className="icon-btn" aria-label="삭제" onClick={() => save(links.filter((x) => x.id !== l.id))}>×</button>
          </li>
        ))}
        {links.length === 0 && <li className="muted">제목 옆 + 버튼으로 자주 가는 사이트를 추가해 보세요.</li>}
      </ul>
      {adding && (
        <>
          <form className="row links-form" onSubmit={add}>
            <input type="text" placeholder="이름 (선택)" maxLength={30} autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
            <input type="text" placeholder="주소" maxLength={300} value={url} onChange={(e) => setUrl(e.target.value)} />
            <button className="btn" type="submit">추가</button>
          </form>
          {error && <p className="error">{error}</p>}
        </>
      )}
    </div>
  )
}
