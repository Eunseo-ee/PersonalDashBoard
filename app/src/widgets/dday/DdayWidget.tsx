import { useState } from 'react'
import type { FormEvent } from 'react'
import { daysUntil } from '../../core/dates'
import type { WidgetProps } from '../types'

interface Item {
  id: string
  name: string
  date: string
}

function label(n: number | null): string {
  if (n === null) return '–'
  if (n === 0) return 'D-day'
  return n > 0 ? `D-${n}` : `D+${-n}`
}

export function DdayWidget({ data, onChange, adding }: WidgetProps) {
  const items = (data.items as Item[] | undefined) ?? []
  const [name, setName] = useState('')
  const [date, setDate] = useState('')

  const save = (next: Item[]) => onChange({ data: { ...data, items: next } })

  function add(e: FormEvent) {
    e.preventDefault()
    const value = name.trim()
    if (!value || !date) return
    save([...items, { id: crypto.randomUUID(), name: value, date }])
    setName('')
    setDate('')
  }

  // 다가오는 날짜가 위, 지난 날짜는 아래로
  const rows = items
    .map((item) => ({ item, n: daysUntil(item.date) }))
    .sort((a, b) => {
      const key = (n: number | null) => (n === null ? 1e9 : n >= 0 ? n : 1e6 - n)
      return key(a.n) - key(b.n)
    })

  return (
    <div className="dday">
      <ul className="dday-list">
        {rows.map(({ item, n }) => {
          const tone = n !== null && n >= 0 ? (n <= 3 ? 'bad' : n <= 7 ? 'warn' : '') : ''
          return (
            <li key={item.id} className={n !== null && n < 0 ? 'dday-item past' : 'dday-item'}>
              <span className="dday-name">{item.name}</span>
              <span className="muted">{item.date}</span>
              <span className={`chip ${tone}`}>{label(n)}</span>
              <button type="button" className="icon-btn" aria-label="삭제" onClick={() => save(items.filter((i) => i.id !== item.id))}>×</button>
            </li>
          )
        })}
        {rows.length === 0 && <li className="muted">제목 옆 + 버튼으로 시험이나 마감일을 추가해 보세요.</li>}
      </ul>
      {adding && (
        <form className="row dday-form" onSubmit={add}>
          <input type="text" placeholder="이름 (예: 오픽 시험)" maxLength={40} autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          <input type="date" aria-label="날짜" value={date} onChange={(e) => setDate(e.target.value)} />
          <button className="btn" type="submit">추가</button>
        </form>
      )}
    </div>
  )
}
