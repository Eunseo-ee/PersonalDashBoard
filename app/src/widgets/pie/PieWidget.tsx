import { useState } from 'react'
import type { FormEvent } from 'react'
import type { WidgetProps } from '../types'

interface Slice {
  id: string
  label: string
  value: number
}

const COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)']
const RADIUS = 36
const CIRC = 2 * Math.PI * RADIUS
const fmt = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 })

function toValue(raw: string): number {
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export function PieWidget({ data, onChange, adding }: WidgetProps) {
  const slices = (data.slices as Slice[] | undefined) ?? []
  const [editList, setEditList] = useState(false)
  const [label, setLabel] = useState('')
  const [value, setValue] = useState('')

  const save = (next: Slice[]) => onChange({ data: { ...data, slices: next } })
  const total = slices.reduce((sum, s) => sum + s.value, 0)

  function add(e: FormEvent) {
    e.preventDefault()
    const name = label.trim()
    if (!name) return
    save([...slices, { id: crypto.randomUUID(), label: name, value: toValue(value) }])
    setLabel('')
    setValue('')
  }

  // 도넛: 같은 원을 항목마다 한 번씩 그리고, 선의 길이(dasharray)와 시작 위치(dashoffset)로 구간을 나눈다.
  const arcs = slices.flatMap((s, i) => {
    if (s.value <= 0 || total <= 0) return []
    const before = slices.slice(0, i).reduce((sum, x) => sum + x.value, 0)
    return [{ id: s.id, color: COLORS[i % COLORS.length], len: (s.value / total) * CIRC, offset: -(before / total) * CIRC }]
  })

  return (
    <div className="pie">
      <div className="pie-main">
        <svg className="pie-svg" viewBox="0 0 100 100" role="img" aria-label="원형 그래프">
          <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="var(--surface2)" strokeWidth="16" />
          {arcs.map((a) => (
            <circle
              key={a.id}
              cx="50"
              cy="50"
              r={RADIUS}
              fill="none"
              stroke={a.color}
              strokeWidth="16"
              strokeDasharray={`${a.len} ${CIRC - a.len}`}
              strokeDashoffset={a.offset}
              transform="rotate(-90 50 50)"
            />
          ))}
          <text x="50" y="48" textAnchor="middle" className="pie-total-label">합계</text>
          <text x="50" y="60" textAnchor="middle" className="pie-total">{fmt.format(total)}</text>
        </svg>

        <ul className="pie-legend">
          {slices.map((s, i) => (
            <li key={s.id}>
              <i className="pie-dot" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="pie-label">{s.label}</span>
              <span className="muted">
                {fmt.format(s.value)}
                {total > 0 && ` · ${Math.round((s.value / total) * 100)}%`}
              </span>
            </li>
          ))}
          {slices.length === 0 && <li className="muted">제목 옆 + 버튼으로 항목을 추가하면 그래프가 그려져요.</li>}
        </ul>
      </div>

      {(editList || adding) && (
        <div className="pie-editor">
          {editList && slices.map((s) => (
            <div key={s.id} className="row">
              <input
                value={s.label}
                maxLength={20}
                aria-label="항목 이름"
                onChange={(e) => save(slices.map((x) => (x.id === s.id ? { ...x, label: e.target.value } : x)))}
              />
              <input
                className="pie-num"
                type="number"
                min="0"
                step="any"
                value={s.value}
                aria-label="값"
                onChange={(e) => save(slices.map((x) => (x.id === s.id ? { ...x, value: toValue(e.target.value) } : x)))}
              />
              <button type="button" className="icon-btn" aria-label="항목 삭제" onClick={() => save(slices.filter((x) => x.id !== s.id))}>×</button>
            </div>
          ))}
          {adding && (
            <form className="row" onSubmit={add}>
              <input placeholder="항목 이름" maxLength={20} autoFocus value={label} onChange={(e) => setLabel(e.target.value)} />
              <input className="pie-num" type="number" min="0" step="any" placeholder="값" value={value} onChange={(e) => setValue(e.target.value)} />
              <button className="btn" type="submit">추가</button>
            </form>
          )}
        </div>
      )}

      {slices.length > 0 && (
        <button type="button" className="btn ghost sm pie-toggle" onClick={() => setEditList((v) => !v)}>
          {editList ? '편집 닫기' : '항목 편집'}
        </button>
      )}
    </div>
  )
}
