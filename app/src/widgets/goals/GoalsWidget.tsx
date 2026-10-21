import { useState } from 'react'
import type { FormEvent } from 'react'
import type { WidgetProps } from '../types'

interface Goal {
  id: string
  text: string
  done: boolean
}

// 체크리스트 + 진행률 바. 프로젝트마다 위젯을 하나씩 만들어 제목만 바꿔 쓰면 프로젝트 진행도가 된다.
export function GoalsWidget({ data, onChange, adding }: WidgetProps) {
  const items = (data.items as Goal[] | undefined) ?? []
  const [text, setText] = useState('')

  const save = (next: Goal[]) => onChange({ data: { ...data, items: next } })
  const done = items.filter((i) => i.done).length
  const pct = items.length ? Math.round((done * 100) / items.length) : 0

  function add(e: FormEvent) {
    e.preventDefault()
    const value = text.trim()
    if (!value) return
    save([...items, { id: crypto.randomUUID(), text: value, done: false }])
    setText('')
  }

  return (
    <div className="todo">
      <div className="goal-progress">
        <div className={pct === 100 && items.length > 0 ? 'track full' : 'track'}>
          <i style={{ width: `${pct}%` }} />
        </div>
        <span className="muted">{done}/{items.length} · {pct}%</span>
      </div>
      <ul className="todo-list">
        {items.map((item) => (
          <li key={item.id} className={item.done ? 'todo-item done' : 'todo-item'}>
            <label>
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => save(items.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)))}
              />
              <span>{item.text}</span>
            </label>
            <button type="button" className="icon-btn" aria-label="삭제" onClick={() => save(items.filter((i) => i.id !== item.id))}>×</button>
          </li>
        ))}
        {items.length === 0 && <li className="muted">제목 옆 + 버튼으로 목표나 단계를 추가해 보세요.</li>}
      </ul>
      {adding && (
        <form className="row todo-form" onSubmit={add}>
          <input type="text" placeholder="항목 추가" maxLength={80} autoFocus value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn" type="submit">추가</button>
        </form>
      )}
    </div>
  )
}
