import { useState } from 'react'
import type { FormEvent } from 'react'
import type { WidgetProps } from '../types'

interface TodoItem {
  id: string
  text: string
  done: boolean
}

export function TodoWidget({ data, onChange, adding }: WidgetProps) {
  const items = (data.items as TodoItem[] | undefined) ?? []
  const [text, setText] = useState('')

  const save = (next: TodoItem[]) => onChange({ data: { ...data, items: next } })

  function add(e: FormEvent) {
    e.preventDefault()
    const value = text.trim()
    if (!value) return
    save([...items, { id: crypto.randomUUID(), text: value, done: false }])
    setText('')
  }

  const doneCount = items.filter((i) => i.done).length

  return (
    <div className="todo">
      <p className="muted todo-count">{doneCount} / {items.length} 완료</p>
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
            <button
              type="button"
              className="icon-btn"
              aria-label="삭제"
              onClick={() => save(items.filter((i) => i.id !== item.id))}
            >
              ×
            </button>
          </li>
        ))}
        {items.length === 0 && <li className="muted">제목 옆 + 버튼으로 할 일을 추가해 보세요.</li>}
      </ul>
      {adding && (
        <form className="row todo-form" onSubmit={add}>
          <input
            type="text"
            placeholder="할 일 추가"
            maxLength={80}
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button className="btn" type="submit">추가</button>
        </form>
      )}
    </div>
  )
}
