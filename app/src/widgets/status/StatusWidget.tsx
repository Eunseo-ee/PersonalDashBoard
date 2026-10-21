import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { WidgetProps } from '../types'

// 편집 모드에서 적어 두고, 평소에는 상태만 보여 주는 목록.
// 상태 종류(이름·색)는 위젯마다 config.kinds 에 저장되어 자유롭게 바꿀 수 있다.

interface Kind {
  id: string
  label: string
  color: string
}

interface Item {
  id: string
  name: string
  sub: string
  kind: string
}

/** 고를 수 있는 색. 테마 변수라 라이트/다크에 맞게 자동으로 바뀐다. */
const COLORS: { value: string; label: string }[] = [
  { value: 'good', label: '초록' },
  { value: 'accent', label: '파랑' },
  { value: 'warn', label: '주황' },
  { value: 'bad', label: '빨강' },
  { value: 'c5', label: '보라' },
  { value: 'c6', label: '청록' },
  { value: 'muted', label: '회색' },
]

/** config.kinds 가 아직 없는 위젯(이전 버전 포함)이 쓰는 기본 종류 */
const DEFAULT_KINDS: Kind[] = [
  { id: 'have', label: '보유', color: 'good' },
  { id: 'prep', label: '준비 중', color: 'accent' },
  { id: 'wip', label: '진행 중', color: 'warn' },
  { id: 'expired', label: '만료', color: 'bad' },
  { id: 'log', label: '이력', color: 'muted' },
]

function readKinds(raw: unknown): Kind[] {
  if (!Array.isArray(raw)) return DEFAULT_KINDS
  const kinds = raw.filter(
    (k): k is Kind => !!k && typeof k.id === 'string' && typeof k.label === 'string' && typeof k.color === 'string',
  )
  return kinds.length > 0 ? kinds : DEFAULT_KINDS
}

function chipStyle(color: string): CSSProperties {
  const v = `var(--${COLORS.some((c) => c.value === color) ? color : 'muted'})`
  return { background: `color-mix(in srgb, ${v} 16%, var(--surface))`, color: v, borderColor: 'transparent' }
}

export function StatusWidget({ config, data, onChange, editing }: WidgetProps) {
  const items = (data.items as Item[] | undefined) ?? []
  const kinds = readKinds(config.kinds)
  const [showKinds, setShowKinds] = useState(false)

  const save = (next: Item[]) => onChange({ data: { ...data, items: next } })
  const patch = (id: string, change: Partial<Item>) => save(items.map((i) => (i.id === id ? { ...i, ...change } : i)))
  const saveKinds = (next: Kind[]) => onChange({ config: { ...config, kinds: next } })
  const kindOf = (id: string): Kind => kinds.find((k) => k.id === id) ?? { id, label: '미지정', color: 'muted' }

  if (!editing) {
    return (
      <ul className="status-list">
        {items.map((i) => {
          const k = kindOf(i.kind)
          return (
            <li key={i.id} className="status-item">
              <div className="status-text">
                <span className="status-name">{i.name || '(이름 없음)'}</span>
                {i.sub && <span className="muted status-sub">{i.sub}</span>}
              </div>
              <span className="chip" style={chipStyle(k.color)}>{k.label}</span>
            </li>
          )
        })}
        {items.length === 0 && <li className="muted">편집 모드에서 항목을 적어 두면 여기에 상태가 표시돼요.</li>}
      </ul>
    )
  }

  function removeKind(id: string) {
    if (kinds.length <= 1) return
    const fallback = kinds.find((k) => k.id !== id)!.id
    // 지운 종류를 쓰던 항목은 남은 첫 번째 종류로 옮긴다.
    onChange({
      config: { ...config, kinds: kinds.filter((k) => k.id !== id) },
      data: { ...data, items: items.map((i) => (i.kind === id ? { ...i, kind: fallback } : i)) },
    })
  }

  return (
    <div className="status-edit">
      <div className="status-kinds">
        <button type="button" className="btn ghost sm" onClick={() => setShowKinds((v) => !v)}>
          {showKinds ? '상태 종류 닫기' : '상태 종류 편집'}
        </button>
        {showKinds && (
          <div className="status-edit">
            {kinds.map((k) => (
              <div key={k.id} className="row">
                <input
                  value={k.label}
                  maxLength={10}
                  aria-label="상태 이름"
                  onChange={(e) => saveKinds(kinds.map((x) => (x.id === k.id ? { ...x, label: e.target.value } : x)))}
                />
                <select
                  value={k.color}
                  aria-label="색"
                  style={{ width: 'auto', flex: 'none', padding: '5px 8px' }}
                  onChange={(e) => saveKinds(kinds.map((x) => (x.id === k.id ? { ...x, color: e.target.value } : x)))}
                >
                  {COLORS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                <span className="chip" style={chipStyle(k.color)}>{k.label || '미리보기'}</span>
                <button type="button" className="icon-btn" aria-label="상태 종류 삭제" disabled={kinds.length <= 1} onClick={() => removeKind(k.id)}>×</button>
              </div>
            ))}
            <button
              type="button"
              className="btn ghost sm status-add"
              onClick={() => saveKinds([...kinds, { id: crypto.randomUUID(), label: '새 상태', color: 'accent' }])}
            >
              + 상태 종류 추가
            </button>
          </div>
        )}
      </div>

      {items.map((i) => (
        <div key={i.id} className="status-edit-item">
          <div className="row">
            <input value={i.name} maxLength={40} placeholder="이름" aria-label="이름" onChange={(e) => patch(i.id, { name: e.target.value })} />
            <select value={kindOf(i.kind).id} aria-label="상태" onChange={(e) => patch(i.id, { kind: e.target.value })}>
              {kinds.map((k) => (
                <option key={k.id} value={k.id}>{k.label}</option>
              ))}
            </select>
            <button type="button" className="icon-btn" aria-label="항목 삭제" onClick={() => save(items.filter((x) => x.id !== i.id))}>×</button>
          </div>
          <input value={i.sub} maxLength={60} placeholder="설명 (선택)" aria-label="설명" onChange={(e) => patch(i.id, { sub: e.target.value })} />
        </div>
      ))}
      <button
        type="button"
        className="btn ghost sm status-add"
        onClick={() => save([...items, { id: crypto.randomUUID(), name: '', sub: '', kind: kinds[0].id }])}
      >
        + 항목 추가
      </button>
    </div>
  )
}