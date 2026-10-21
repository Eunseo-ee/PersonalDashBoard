import { useEffect, useRef } from 'react'
import { addDays, dateKey, mondayOf } from '../../core/dates'
import type { WidgetProps } from '../types'

/** 날짜 → 진하기(1~3). 0이면 키 자체를 지운다. */
type Levels = Record<string, number>
const WEEKS = 26
const MAX_LEVEL = 3

export function GrassWidget({ data, onChange }: WidgetProps) {
  const levels = (data.levels as Levels | undefined) ?? {}
  const scrollRef = useRef<HTMLDivElement>(null)

  // 처음 열 때 가장 최근(오른쪽 끝)이 보이게 한다.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [])

  const today = new Date()
  const todayKey = dateKey(today)
  const start = addDays(mondayOf(today), -7 * (WEEKS - 1))

  // 칸을 누를 때마다 없음 → 1 → 2 → 3 → 없음
  function cycle(key: string) {
    const next = ((levels[key] ?? 0) + 1) % (MAX_LEVEL + 1)
    const copy = { ...levels }
    if (next === 0) delete copy[key]
    else copy[key] = next
    onChange({ data: { ...data, levels: copy } })
  }

  const startKey = dateKey(start)
  const activeDays = Object.keys(levels).filter((k) => k >= startKey && k <= todayKey && levels[k] > 0).length
  const weeks = Array.from({ length: WEEKS }, (_, w) => {
    const monday = addDays(start, 7 * w)
    const month = monday.getMonth()
    const prevMonth = w === 0 ? -1 : addDays(start, 7 * (w - 1)).getMonth()
    const monthLabel = month !== prevMonth ? `${month + 1}월` : ''
    const cells = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(monday, i)
      const key = dateKey(d)
      if (key > todayKey) return <i key={key} className="grass-cell none" />
      const level = levels[key] ?? 0
      return (
        <button
          key={key}
          type="button"
          className={`grass-cell l${level}`}
          title={`${key} · ${level ? `진하기 ${level}` : '기록 없음'}`}
          aria-label={`${key} ${level ? `진하기 ${level}` : '기록 없음'}`}
          onClick={() => cycle(key)}
        />
      )
    })
    return (
      <div key={monday.getTime()} className="grass-week">
        <span className="grass-month">{monthLabel}</span>
        {cells}
      </div>
    )
  })

  // 오늘(없으면 어제)부터 거꾸로 이어진 날 수
  let streak = 0
  let d = today
  if (!levels[todayKey]) d = addDays(d, -1)
  while ((levels[dateKey(d)] ?? 0) > 0 && streak < 400) {
    streak++
    d = addDays(d, -1)
  }

  return (
    <div className="grass">
      <p className="muted grass-meta">최근 {WEEKS}주 {activeDays}일 · 현재 연속 {streak}일</p>
      <div className="grass-scroll" ref={scrollRef}>
        <div className="grass-grid">
          <div className="grass-week grass-dow">
            <span className="grass-month" />
            {['월', '', '수', '', '금', '', ''].map((t, i) => (
              <span key={i} className="grass-dow-label">{t}</span>
            ))}
          </div>
          {weeks}
        </div>
      </div>
      <div className="grass-legend muted">
        적음 <i className="grass-cell l0" /><i className="grass-cell l1" /><i className="grass-cell l2" /><i className="grass-cell l3" /> 많음
      </div>
      <p className="muted grass-hint">칸을 누를 때마다 진하기가 바뀌어요. (없음 → 1 → 2 → 3 → 없음)</p>
    </div>
  )
}
