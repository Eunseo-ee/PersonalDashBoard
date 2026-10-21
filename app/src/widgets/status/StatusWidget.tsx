import type { WidgetProps } from '../types'

// 편집 모드에서 적어 두고, 평소에는 상태만 보여 주는 목록. (자격·스펙, 준비 현황, 프로젝트 진행 상태 등)

type Kind = 'have' | 'expired' | 'prep' | 'wip' | 'log'

interface Item {
  id: string
  name: string
  sub: string
  kind: Kind
}

const KINDS: { value: Kind; label: string }[] = [
  { value: 'have', label: '보유' },
  { value: 'prep', label: '준비 중' },
  { value: 'wip', label: '진행 중' },
  { value: 'expired', label: '만료' },
  { value: 'log', label: '이력' },
]

function kindOf(raw: unknown): Kind {
  return KINDS.some((k) => k.value === raw) ? (raw as Kind) : 'log'
}

export function StatusWidget({ data, onChange, editing }: WidgetProps) {
  const items = (data.items as Item[] | undefined) ?? []
  const save = (next: Item[]) => onChange({ data: { ...data, items: next } })
  const patch = (id: string, change: Partial<Item>) => save(items.map((i) => (i.id === id ? { ...i, ...change } : i)))

  if (!editing) {
    return (
      <ul className="status-list">
        {items.map((i) => {
          const kind = kindOf(i.kind)
          return (
            <li key={i.id} className="status-item">
              <div className="status-text">
                <span className="status-name">{i.name || '(이름 없음)'}</span>
                {i.sub && <span className="muted status-sub">{i.sub}</span>}
              </div>
              <span className={`chip k-${kind}`}>{KINDS.find((k) => k.value === kind)?.label}</span>
            </li>
          )
        })}
        {items.length === 0 && <li className="muted">편집 모드에서 항목을 적어 두면 여기에 상태가 표시돼요.</li>}
      </ul>
    )
  }

  return (
    <div className="status-edit">
      {items.map((i) => (
        <div key={i.id} className="status-edit-item">
          <div className="row">
            <input value={i.name} maxLength={40} placeholder="이름" aria-label="이름" onChange={(e) => patch(i.id, { name: e.target.value })} />
            <select value={kindOf(i.kind)} aria-label="상태" onChange={(e) => patch(i.id, { kind: kindOf(e.target.value) })}>
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
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
        onClick={() => save([...items, { id: crypto.randomUUID(), name: '', sub: '', kind: 'prep' }])}
      >
        + 항목 추가
      </button>
    </div>
  )
}
