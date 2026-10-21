import { useState } from 'react'
import type { WidgetRow } from '../core/types'
import { widgetRegistry } from '../widgets/registry'
import type { WidgetProps } from '../widgets/types'

interface Props {
  widget: WidgetRow
  editing: boolean
  onChange: WidgetProps['onChange']
  onDelete: () => void
}

/** 모든 위젯을 감싸는 공통 껍데기: 제목 줄, 편집 모드의 이동 손잡이와 삭제 버튼. */
export function WidgetCard({ widget, editing, onChange, onDelete }: Props) {
  const def = widgetRegistry[widget.type]
  const title = typeof widget.config.title === 'string' ? widget.config.title : (def?.label ?? widget.type)
  const Body = def?.component
  const [adding, setAdding] = useState(false)

  return (
    <div className="widget">
      <div className={editing ? 'widget-head widget-handle editing' : 'widget-head'}>
        <div className="widget-title">
          {editing ? (
            <input
              className="widget-title-input"
              value={title}
              maxLength={40}
              aria-label="위젯 제목"
              onChange={(e) => onChange({ config: { ...widget.config, title: e.target.value } })}
            />
          ) : (
            <strong>{title}</strong>
          )}
          {def?.hasAdd && (
            <button
              type="button"
              className={adding ? 'add-btn on' : 'add-btn'}
              aria-label={adding ? '추가 입력란 닫기' : '항목 추가'}
              aria-expanded={adding}
              onClick={() => setAdding((v) => !v)}
            >
              {adding ? '×' : '+'}
            </button>
          )}
        </div>
        {editing && (
          <button type="button" className="icon-btn" aria-label="위젯 삭제" onClick={onDelete}>
            ×
          </button>
        )}
      </div>
      <div className="widget-body">
        {Body ? (
          <Body config={widget.config} data={widget.data} onChange={onChange} editing={editing} adding={adding} />
        ) : (
          <p className="muted">지원하지 않는 위젯이에요. ({widget.type})</p>
        )}
      </div>
    </div>
  )
}
