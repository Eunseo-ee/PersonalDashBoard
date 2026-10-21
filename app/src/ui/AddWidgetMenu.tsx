import { useEffect, useRef, useState } from 'react'
import { widgetRegistry } from '../widgets/registry'

interface Props {
  disabled: boolean
  onPick: (type: string) => void
}

/** "+ 추가" 버튼을 누르면 등록된 위젯 종류가 목록으로 나오고, 하나를 고르면 추가된다. */
export function AddWidgetMenu({ disabled, onPick }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // 바깥을 누르거나 Esc를 누르면 닫는다.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="menu" ref={ref}>
      <button type="button" className="btn" aria-haspopup="menu" aria-expanded={open} disabled={disabled} onClick={() => setOpen((v) => !v)}>
        + 추가
      </button>
      {open && (
        <ul className="menu-list" role="menu">
          {Object.entries(widgetRegistry).map(([type, def]) => (
            <li key={type} role="none">
              <button
                type="button"
                role="menuitem"
                className="menu-item"
                onClick={() => {
                  setOpen(false)
                  onPick(type)
                }}
              >
                <strong>{def.label}</strong>
                <span className="muted">{def.description}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
