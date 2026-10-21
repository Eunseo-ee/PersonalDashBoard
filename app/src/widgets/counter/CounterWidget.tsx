import { useState } from 'react'
import type { WidgetProps } from '../types'

const fmt = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 })

export function CounterWidget({ config, data, onChange }: WidgetProps) {
  const value = typeof data.value === 'number' ? data.value : 0
  const step = typeof config.step === 'number' && config.step > 0 ? config.step : 1
  const unit = typeof config.unit === 'string' ? config.unit : ''
  const [showSettings, setShowSettings] = useState(false)
  const [stepStr, setStepStr] = useState(String(step))

  const set = (next: number) => onChange({ data: { ...data, value: Math.round(next * 100) / 100 } })

  return (
    <div className="counter">
      <div className="counter-value">
        {fmt.format(value)}
        {unit && <small>{unit}</small>}
      </div>
      <div className="row">
        <button type="button" className="btn ghost counter-btn" aria-label="줄이기" onClick={() => set(value - step)}>−</button>
        <button type="button" className="btn counter-btn" aria-label="늘리기" onClick={() => set(value + step)}>+</button>
      </div>
      <button type="button" className="btn ghost sm" onClick={() => setShowSettings((v) => !v)}>
        {showSettings ? '설정 닫기' : '설정'}
      </button>
      {showSettings && (
        <div className="counter-settings">
          <label>
            <span className="muted">한 번에 바꿀 양</span>
            <input
              type="number"
              min="0"
              step="any"
              value={stepStr}
              onChange={(e) => {
                setStepStr(e.target.value)
                const n = Number(e.target.value)
                if (Number.isFinite(n) && n > 0) onChange({ config: { ...config, step: n } })
              }}
            />
          </label>
          <label>
            <span className="muted">단위 (선택)</span>
            <input value={unit} maxLength={6} placeholder="예: 잔, 문제" onChange={(e) => onChange({ config: { ...config, unit: e.target.value } })} />
          </label>
          <button type="button" className="btn ghost sm" onClick={() => set(0)}>0으로 초기화</button>
        </div>
      )}
    </div>
  )
}
