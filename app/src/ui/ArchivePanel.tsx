import type { WidgetRow } from '../core/types'
import { widgetRegistry } from '../widgets/registry'

interface Props {
  widgets: WidgetRow[]
  busyId: string | null
  onRestore: (widget: WidgetRow) => void
  onDelete: (widget: WidgetRow) => void
  onClose: () => void
}

function widgetTitle(widget: WidgetRow): string {
  const def = widgetRegistry[widget.type]
  return typeof widget.config.title === 'string' && widget.config.title ? widget.config.title : (def?.label ?? widget.type)
}

/** 보관된 위젯 목록. 복원하면 대시보드로 돌아가고, 완전 삭제하면 기록까지 사라진다. */
export function ArchivePanel({ widgets, busyId, onRestore, onDelete, onClose }: Props) {
  return (
    <section className="panel archive" aria-label="보관함">
      <div className="archive-head">
        <strong>보관함</strong>
        <button type="button" className="icon-btn" aria-label="보관함 닫기" onClick={onClose}>
          ×
        </button>
      </div>
      {widgets.length === 0 ? (
        <p className="muted">보관한 위젯이 없어요. 편집 모드에서 위젯의 “보관”을 누르면 여기로 옮겨져요.</p>
      ) : (
        <ul className="archive-list">
          {widgets.map((w) => (
            <li key={w.id} className="archive-item">
              <div className="archive-info">
                <strong>{widgetTitle(w)}</strong>
                <span className="muted">
                  {widgetRegistry[w.type]?.label ?? w.type} · {new Date(w.updated_at).toLocaleDateString()} 보관
                </span>
              </div>
              <div className="archive-actions">
                <button type="button" className="btn sm" disabled={busyId === w.id} onClick={() => onRestore(w)}>
                  복원
                </button>
                <button type="button" className="btn sm danger" disabled={busyId === w.id} onClick={() => onDelete(w)}>
                  완전 삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
