import { useState } from 'react'
import type { FormEvent } from 'react'
import type { WidgetProps } from '../types'

interface Point {
  id: string
  label: string
  value: number
}
type Kind = 'bar' | 'line'

// SVG 좌표계. 화면에서는 위젯 크기에 맞춰 통째로 늘어나고 줄어든다.
const W = 300
const H = 170
const PAD = { l: 32, r: 8, t: 16, b: 24 }
const PW = W - PAD.l - PAD.r
const PH = H - PAD.t - PAD.b
const fmt = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 })

function toValue(raw: string): number {
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

/** 눈금 맨 위 값을 1, 2, 5 × 10ⁿ 중 하나로 올린다. */
function niceMax(max: number): number {
  if (max <= 0) return 1
  const pow = 10 ** Math.floor(Math.log10(max))
  const f = max / pow
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow
}

function shorten(label: string): string {
  return label.length > 5 ? `${label.slice(0, 5)}…` : label
}

export function ChartWidget({ config, data, onChange, adding }: WidgetProps) {
  const points = (data.points as Point[] | undefined) ?? []
  const kind: Kind = config.kind === 'line' ? 'line' : 'bar'
  const [editList, setEditList] = useState(false)
  const [label, setLabel] = useState('')
  const [value, setValue] = useState('')

  const save = (next: Point[]) => onChange({ data: { ...data, points: next } })

  function add(e: FormEvent) {
    e.preventDefault()
    const name = label.trim()
    if (!name) return
    save([...points, { id: crypto.randomUUID(), label: name, value: toValue(value) }])
    setLabel('')
    setValue('')
  }

  const n = points.length
  const top = niceMax(Math.max(0, ...points.map((p) => p.value)))
  const band = n > 0 ? PW / n : PW
  const cx = (i: number) => PAD.l + band * (i + 0.5)
  const cy = (v: number) => PAD.t + PH * (1 - v / top)
  const labelEvery = Math.ceil(n / 10) || 1
  const showValues = n <= 12
  const ticks = [0, top / 2, top]

  return (
    <div className="chart">
      <div className="chart-head">
        <div className="seg">
          <button type="button" className={kind === 'bar' ? 'on' : ''} onClick={() => onChange({ config: { ...config, kind: 'bar' } })}>막대</button>
          <button type="button" className={kind === 'line' ? 'on' : ''} onClick={() => onChange({ config: { ...config, kind: 'line' } })}>꺾은선</button>
        </div>
        {points.length > 0 && (
          <button type="button" className="btn ghost sm" onClick={() => setEditList((v) => !v)}>
            {editList ? '편집 닫기' : '항목 편집'}
          </button>
        )}
      </div>

      <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={kind === 'bar' ? '막대 그래프' : '꺾은선 그래프'}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={cy(t)} y2={cy(t)} stroke="var(--line)" strokeWidth="0.6" />
            <text x={PAD.l - 4} y={cy(t) + 3} textAnchor="end" className="chart-axis">{fmt.format(t)}</text>
          </g>
        ))}

        {kind === 'bar' &&
          points.map((p, i) => {
            const bw = Math.min(band * 0.6, 28)
            return (
              <g key={p.id}>
                <rect x={cx(i) - bw / 2} y={cy(p.value)} width={bw} height={PAD.t + PH - cy(p.value)} rx="2" fill="var(--c1)" />
                {showValues && <text x={cx(i)} y={cy(p.value) - 3} textAnchor="middle" className="chart-axis">{fmt.format(p.value)}</text>}
              </g>
            )
          })}

        {kind === 'line' && n > 0 && (
          <>
            <polyline
              fill="none"
              stroke="var(--c1)"
              strokeWidth="1.8"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={points.map((p, i) => `${cx(i)},${cy(p.value)}`).join(' ')}
            />
            {points.map((p, i) => (
              <g key={p.id}>
                <circle cx={cx(i)} cy={cy(p.value)} r="2.6" fill="var(--c1)" />
                {showValues && <text x={cx(i)} y={cy(p.value) - 6} textAnchor="middle" className="chart-axis">{fmt.format(p.value)}</text>}
              </g>
            ))}
          </>
        )}

        {points.map((p, i) =>
          i % labelEvery === 0 ? (
            <text key={p.id} x={cx(i)} y={H - 8} textAnchor="middle" className="chart-axis">{shorten(p.label)}</text>
          ) : null,
        )}
      </svg>

      {points.length === 0 && !adding && <p className="muted">제목 옆 + 버튼으로 값을 추가하면 그래프가 그려져요.</p>}

      {(editList || adding) && (
        <div className="pie-editor">
          {editList && points.map((p) => (
            <div key={p.id} className="row">
              <input
                value={p.label}
                maxLength={20}
                aria-label="항목 이름"
                onChange={(e) => save(points.map((x) => (x.id === p.id ? { ...x, label: e.target.value } : x)))}
              />
              <input
                className="pie-num"
                type="number"
                min="0"
                step="any"
                value={p.value}
                aria-label="값"
                onChange={(e) => save(points.map((x) => (x.id === p.id ? { ...x, value: toValue(e.target.value) } : x)))}
              />
              <button type="button" className="icon-btn" aria-label="항목 삭제" onClick={() => save(points.filter((x) => x.id !== p.id))}>×</button>
            </div>
          ))}
          {adding && (
            <form className="row" onSubmit={add}>
              <input placeholder="항목 이름 (예: 월)" maxLength={20} autoFocus value={label} onChange={(e) => setLabel(e.target.value)} />
              <input className="pie-num" type="number" min="0" step="any" placeholder="값" value={value} onChange={(e) => setValue(e.target.value)} />
              <button className="btn" type="submit">추가</button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
