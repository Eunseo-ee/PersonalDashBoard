import { useState } from 'react'
import type { FormEvent } from 'react'
import { DOW, addDays, dateKey, daysInMonth, mondayOf } from '../../core/dates'
import type { WidgetProps } from '../types'

interface Habit {
  id: string
  name: string
}
/** 날짜 → 그날 한 습관 id 목록 */
type Checks = Record<string, string[]>
type View = 'week' | 'month'

export function HabitWidget({ data, onChange, editing }: WidgetProps) {
  const habits = (data.habits as Habit[] | undefined) ?? []
  const checks = (data.checks as Checks | undefined) ?? {}

  // 보는 방식과 기준 날짜는 화면 상태일 뿐이라 저장하지 않는다.
  const [view, setView] = useState<View>('week')
  const [anchor, setAnchor] = useState(() => new Date())
  const [pick, setPick] = useState(0)
  const [name, setName] = useState('')

  const todayKey = dateKey(new Date())
  const save = (next: { habits?: Habit[]; checks?: Checks }) => onChange({ data: { ...data, ...next } })
  const isOn = (habitId: string, key: string) => (checks[key] ?? []).includes(habitId)

  function toggle(habitId: string, key: string) {
    const cur = checks[key] ?? []
    const arr = cur.includes(habitId) ? cur.filter((x) => x !== habitId) : [...cur, habitId]
    const next = { ...checks }
    if (arr.length > 0) next[key] = arr
    else delete next[key]
    save({ checks: next })
  }

  function addHabit(e: FormEvent) {
    e.preventDefault()
    const value = name.trim()
    if (!value) return
    save({ habits: [...habits, { id: crypto.randomUUID(), name: value }] })
    setName('')
  }

  function renameHabit(id: string, value: string) {
    save({ habits: habits.map((h) => (h.id === id ? { ...h, name: value } : h)) })
  }

  function removeHabit(id: string) {
    const next: Checks = {}
    for (const [key, ids] of Object.entries(checks)) {
      const rest = ids.filter((x) => x !== id)
      if (rest.length > 0) next[key] = rest
    }
    save({ habits: habits.filter((h) => h.id !== id), checks: next })
  }

  function streak(habitId: string): number {
    let d = new Date()
    if (!isOn(habitId, dateKey(d))) d = addDays(d, -1)
    let n = 0
    while (isOn(habitId, dateKey(d)) && n < 400) {
      n++
      d = addDays(d, -1)
    }
    return n
  }

  function move(step: number) {
    if (step === 0) setAnchor(new Date())
    else if (view === 'week') setAnchor(addDays(anchor, 7 * step))
    else setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + step, 1))
  }

  // 보여줄 날짜들
  const days: Date[] =
    view === 'week'
      ? Array.from({ length: 7 }, (_, i) => addDays(mondayOf(anchor), i))
      : Array.from({ length: daysInMonth(anchor) }, (_, i) => new Date(anchor.getFullYear(), anchor.getMonth(), i + 1))
  const first = days[0]
  const label =
    view === 'week'
      ? `${first.getMonth() + 1}.${first.getDate()} – ${days[6].getMonth() + 1}.${days[6].getDate()}`
      : `${first.getFullYear()}년 ${first.getMonth() + 1}월`

  const tools = (
    <div className="habit-tools">
      <div className="seg">
        <button type="button" className={view === 'week' ? 'on' : ''} onClick={() => setView('week')}>주</button>
        <button type="button" className={view === 'month' ? 'on' : ''} onClick={() => setView('month')}>월</button>
      </div>
      <button type="button" className="btn ghost sm" aria-label="이전" onClick={() => move(-1)}>‹</button>
      <span className="muted habit-label">{label}</span>
      <button type="button" className="btn ghost sm" aria-label="다음" onClick={() => move(1)}>›</button>
      <button type="button" className="btn ghost sm" onClick={() => move(0)}>오늘</button>
    </div>
  )

  const addForm = (
    <form className="row habit-form" onSubmit={addHabit}>
      <input type="text" placeholder="습관 추가 (예: 운동)" maxLength={30} value={name} onChange={(e) => setName(e.target.value)} />
      <button className="btn" type="submit">추가</button>
    </form>
  )

  if (habits.length === 0) {
    return (
      <div className="habit">
        <p className="muted">습관을 추가하면 칸을 눌러 그날 한 걸로 표시할 수 있어요.</p>
        {addForm}
      </div>
    )
  }

  // ---------- 월 보기: 습관 하나를 달력으로 ----------
  if (view === 'month') {
    const cur = habits[Math.min(pick, habits.length - 1)]
    const lead = (first.getDay() + 6) % 7
    let done = 0
    let elapsed = 0
    for (const d of days) {
      const k = dateKey(d)
      if (k <= todayKey) elapsed++
      if (isOn(cur.id, k)) done++
    }
    const step = (n: number) => setPick((Math.min(pick, habits.length - 1) + n + habits.length) % habits.length)

    return (
      <div className="habit">
        {tools}
        <div className="habit-pick">
          <button type="button" className="btn ghost sm" aria-label="이전 습관" disabled={habits.length < 2} onClick={() => step(-1)}>‹</button>
          <div className="habit-pick-name">
            {editing ? (
              <input value={cur.name} maxLength={30} aria-label="습관 이름" onChange={(e) => renameHabit(cur.id, e.target.value)} />
            ) : (
              <strong>{cur.name}</strong>
            )}
            <span className="muted">{Math.min(pick, habits.length - 1) + 1} / {habits.length}</span>
          </div>
          <button type="button" className="btn ghost sm" aria-label="다음 습관" disabled={habits.length < 2} onClick={() => step(1)}>›</button>
          {editing && <button type="button" className="icon-btn" aria-label="습관 삭제" onClick={() => removeHabit(cur.id)}>×</button>}
        </div>
        <div className="habit-cal">
          {['월', '화', '수', '목', '금', '토', '일'].map((w) => (
            <div key={w} className="habit-cal-dow">{w}</div>
          ))}
          {Array.from({ length: lead }, (_, i) => <div key={`b${i}`} />)}
          {days.map((d) => {
            const k = dateKey(d)
            const on = isOn(cur.id, k)
            const future = k > todayKey
            const cls = ['habit-day', on ? 'on' : '', k === todayKey ? 'today' : ''].filter(Boolean).join(' ')
            return (
              <button key={k} type="button" className={cls} disabled={future} aria-pressed={on} aria-label={`${cur.name} ${k}`} onClick={() => toggle(cur.id, k)}>
                {d.getDate()}
              </button>
            )
          })}
        </div>
        <p className="muted habit-sum">이달 {done}/{elapsed}일 · 현재 연속 {streak(cur.id)}일</p>
        {addForm}
      </div>
    )
  }

  // ---------- 주 보기: 습관 × 7일 표 ----------
  const elapsed = days.filter((d) => dateKey(d) <= todayKey).length
  return (
    <div className="habit">
      {tools}
      <div className="habit-scroll">
        <div className="habit-grid">
          <div className="habit-name muted">습관</div>
          {days.map((d) => (
            <div key={dateKey(d)} className={dateKey(d) === todayKey ? 'habit-dh today' : 'habit-dh'}>
              <span>{DOW[d.getDay()]}</span>
              <b>{d.getDate()}</b>
            </div>
          ))}
          <div className="habit-rate muted">달성</div>
          {habits.map((h) => {
            const done = days.filter((d) => isOn(h.id, dateKey(d))).length
            return (
              <div key={h.id} className="habit-row">
                <div className="habit-name">
                  {editing ? (
                    <div className="row">
                      <input value={h.name} maxLength={30} aria-label="습관 이름" onChange={(e) => renameHabit(h.id, e.target.value)} />
                      <button type="button" className="icon-btn" aria-label="습관 삭제" onClick={() => removeHabit(h.id)}>×</button>
                    </div>
                  ) : (
                    h.name
                  )}
                </div>
                {days.map((d) => {
                  const k = dateKey(d)
                  const on = isOn(h.id, k)
                  const future = k > todayKey
                  return (
                    <div key={k} className="habit-cell">
                      <button type="button" className={on ? 'habit-box on' : 'habit-box'} disabled={future} aria-pressed={on} aria-label={`${h.name} ${k}`} onClick={() => toggle(h.id, k)} />
                    </div>
                  )
                })}
                <div className="habit-rate muted">{elapsed ? `${done}/${elapsed}` : '–'}</div>
              </div>
            )
          })}
        </div>
      </div>
      {addForm}
    </div>
  )
}
