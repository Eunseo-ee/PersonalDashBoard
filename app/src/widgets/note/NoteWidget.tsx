import type { WidgetProps } from '../types'

export function NoteWidget({ data, onChange }: WidgetProps) {
  const text = typeof data.text === 'string' ? data.text : ''

  return (
    <textarea
      className="note"
      value={text}
      placeholder="메모를 적어 보세요"
      aria-label="메모"
      onChange={(e) => onChange({ data: { ...data, text: e.target.value } })}
    />
  )
}
