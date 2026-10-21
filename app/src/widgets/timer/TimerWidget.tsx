import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { DOW, addDays, dateKey, mondayOf } from '../../core/dates'
import type { WidgetProps } from '../types'

type Mode = 'stopwatch' | 'pomodoro'
type Kind = 'focus' | 'break'

/** 돌아가는 중인 타이머. 시작 시각만 저장해 두고 경과 시간은 매번 계산하므로 새로고침해도 이어진다. */
interface Running {
  mode: Mode
  kind: Kind
  startedAt: number
  /** 카운트다운 목표(초). 스톱워치는 null */
  target: number | null
}
/** 날짜 → 그날 공부한 초 */
type Log = Record<string, number>

function minutesOr(raw: unknown, fallback: number): number {
  const n = Number(raw)
  return Number.isFinite(n) && n >= 1 && n <= 180 ? Math.round(n) : fallback
}

function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

function duration(sec: number): string {
  const m = Math.round(sec / 60)
  const h = Math.floor(m / 60)
  if (h === 0) return `${m}분`
  return m % 60 === 0 ? `${h}시간` : `${h}시간 ${m % 60}분`
}

function short(sec: number): string {
  const m = Math.round(sec / 60)
  if (m === 0) return ''
  return m < 60 ? `${m}m` : `${(m / 60).toFixed(1)}h`
}

export function TimerWidget({ config, data, onChange, adding }: WidgetProps) {
  const log = (data.log as Log | undefined) ?? {}
  const running = (data.running as Running | null | undefined) ?? null
  const focusMin = minutesOr(config.focusMin, 25)
  const breakMin = minutesOr(config.breakMin, 5)

  const [mode, setMode] = useState<Mode>('stopwatch')
  const [now, setNow] = useState(() => Date.now())
  const [notice, setNotice] = useState('')
  const [afterFocus, setAfterFocus] = useState(false)
  const [manual, setManual] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [focusStr, setFocusStr] = useState(String(focusMin))
  const [breakStr, setBreakStr] = useState(String(breakMin))
  const finishing = useRef(false)

  // 돌아가는 동안만 1초마다 화면을 갱신한다.
  const startedAt = running?.startedAt ?? null
  useEffect(() => {
    if (startedAt === null) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [startedAt])

  const elapsed = running ? Math.max(0, (now - running.startedAt) / 1000) : 0

  function commit(key: string, seconds: number, nextRunning: Running | null) {
    const next = { ...log, [key]: (log[key] ?? 0) + Math.round(seconds) }
    onChange({ data: { ...data, log: next, running: nextRunning } })
  }

  // 카운트다운이 끝났을 때(창을 닫아 둔 사이에 끝난 경우 포함) 한 번만 처리한다.
  useEffect(() => {
    if (!running || running.target === null || finishing.current) return
    if (elapsed < running.target) return
    finishing.current = true
    if (running.kind === 'focus') {
      commit(dateKey(new Date(running.startedAt)), running.target, null)
      setNotice('집중 완료! 잠깐 쉬어 볼까요?')
      setAfterFocus(true)
    } else {
      onChange({ data: { ...data, running: null } })
      setNotice('휴식 끝! 다시 시작해 볼까요?')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, running])

  function start(kind: Kind) {
    const m: Mode = kind === 'break' ? 'pomodoro' : mode
    const target = m === 'pomodoro' ? (kind === 'focus' ? focusMin : breakMin) * 60 : null
    const t = Date.now()
    finishing.current = false
    setNow(t)
    setNotice('')
    setAfterFocus(false)
    onChange({ data: { ...data, running: { mode: m, kind, startedAt: t, target } } })
  }

  function stop() {
    if (!running) return
    if (running.kind === 'focus') commit(dateKey(new Date(running.startedAt)), elapsed, null)
    else onChange({ data: { ...data, running: null } })
  }

  function cancel() {
    onChange({ data: { ...data, running: null } })
  }

  function addManual(e: FormEvent) {
    e.preventDefault()
    const m = Number(manual)
    if (!Number.isFinite(m) || m <= 0 || m > 1440) return
    commit(dateKey(new Date()), m * 60, running)
    setManual('')
  }

  // ---------- 통계 ----------
  const today = new Date()
  const todayKey = dateKey(today)
  const live = running && running.kind === 'focus' ? elapsed : 0
  const sum = (keys: string[]) => keys.reduce((s, k) => s + (log[k] ?? 0), 0) + live
  const weekKeys = Array.from({ length: 7 }, (_, i) => dateKey(addDays(mondayOf(today), i)))
  const monthPrefix = todayKey.slice(0, 7)
  const monthKeys = Object.keys(log).filter((k) => k.startsWith(monthPrefix))
  const total = Object.values(log).reduce((s, v) => s + v, 0) + live

  const days7 = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6))
  const vals = days7.map((d) => (log[dateKey(d)] ?? 0) + (dateKey(d) === todayKey ? live : 0))
  const maxVal = Math.max(...vals, 1)

  // ---------- 표시 ----------
  const shownMode = running ? running.mode : mode
  const bigClock = running
    ? clock(running.target !== null ? running.target - elapsed : elapsed)
    : shownMode === 'pomodoro'
      ? clock(focusMin * 60)
      : clock(0)
  const caption = running
    ? running.kind === 'break'
      ? '휴식 중'
      : running.mode === 'pomodoro'
        ? '집중 중'
        : '공부 중'
    : shownMode === 'pomodoro'
      ? `집중 ${focusMin}분 · 휴식 ${breakMin}분`
      : '스톱워치'

  return (
    <div className="timer">
      {/* 돌아가는 중에도 자리를 비워 두어, 상태가 바뀌어도 위젯 높이가 흔들리지 않게 한다. */}
      <div className={running ? 'seg hidden' : 'seg'} aria-hidden={running ? true : undefined}>
        <button type="button" disabled={!!running} className={mode === 'stopwatch' ? 'on' : ''} onClick={() => setMode('stopwatch')}>스톱워치</button>
        <button type="button" disabled={!!running} className={mode === 'pomodoro' ? 'on' : ''} onClick={() => setMode('pomodoro')}>뽀모도로</button>
      </div>
      <div className="muted">{caption}</div>
      <div className="timer-clock" role="timer">{bigClock}</div>
      {notice && <p className="timer-notice">{notice}</p>}

      <div className="row timer-buttons">
        {!running && <button type="button" className="btn" onClick={() => start('focus')}>시작</button>}
        {!running && afterFocus && <button type="button" className="btn ghost" onClick={() => start('break')}>휴식 시작</button>}
        {running && running.kind === 'focus' && (
          <>
            <button type="button" className="btn" onClick={stop}>중지 · 기록</button>
            <button type="button" className="btn ghost" onClick={cancel}>취소</button>
          </>
        )}
        {running && running.kind === 'break' && <button type="button" className="btn ghost" onClick={stop}>휴식 끝내기</button>}
      </div>

      <div className="timer-stats">
        <div><span className="muted">오늘</span><b>{duration(sum([todayKey]))}</b></div>
        <div><span className="muted">이번 주</span><b>{duration(sum(weekKeys))}</b></div>
        <div><span className="muted">이번 달</span><b>{duration(sum(monthKeys))}</b></div>
        <div><span className="muted">전체</span><b>{duration(total)}</b></div>
      </div>

      <div className="timer-bars" aria-label="최근 7일 공부 시간">
        {days7.map((d, i) => (
          <div key={dateKey(d)} className={dateKey(d) === todayKey ? 'timer-bar today' : 'timer-bar'}>
            <span className="muted">{short(vals[i])}</span>
            <div className="timer-bar-track"><i style={{ height: `${(vals[i] / maxVal) * 100}%` }} /></div>
            <span className="muted">{DOW[d.getDay()]}</span>
          </div>
        ))}
      </div>

      {adding && (
        <form className="row" onSubmit={addManual}>
          <input type="number" min="1" max="1440" placeholder="분" aria-label="직접 추가할 시간(분)" autoFocus value={manual} onChange={(e) => setManual(e.target.value)} />
          <button className="btn ghost" type="submit">오늘에 추가</button>
        </form>
      )}

      <button type="button" className="btn ghost sm timer-settings-btn" onClick={() => setShowSettings((v) => !v)}>
        {showSettings ? '설정 닫기' : '뽀모도로 설정'}
      </button>
      {showSettings && (
        <div className="counter-settings">
          <label>
            <span className="muted">집중 (분)</span>
            <input
              type="number"
              min="1"
              max="180"
              value={focusStr}
              onChange={(e) => {
                setFocusStr(e.target.value)
                const n = Number(e.target.value)
                if (Number.isFinite(n) && n >= 1 && n <= 180) onChange({ config: { ...config, focusMin: Math.round(n) } })
              }}
            />
          </label>
          <label>
            <span className="muted">휴식 (분)</span>
            <input
              type="number"
              min="1"
              max="180"
              value={breakStr}
              onChange={(e) => {
                setBreakStr(e.target.value)
                const n = Number(e.target.value)
                if (Number.isFinite(n) && n >= 1 && n <= 180) onChange({ config: { ...config, breakMin: Math.round(n) } })
              }}
            />
          </label>
        </div>
      )}
    </div>
  )
}
