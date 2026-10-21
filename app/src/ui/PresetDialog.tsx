import { useEffect, useState } from 'react'
import { listPresets } from '../core/presets'
import type { ApplyMode } from '../core/presets'
import type { Preset } from '../core/types'
import { widgetRegistry } from '../widgets/registry'

interface Props {
  /** 지금 대시보드에 보이는 위젯 수 (적용 방식 안내용) */
  activeCount: number
  onApply: (preset: Preset, mode: ApplyMode) => Promise<void>
  onClose: () => void
}

/** 프리셋에 들어 있는 위젯 종류를 "할 일 · D-day …" 형태로 (중복 제거) */
function kinds(preset: Preset): string {
  const labels = preset.layout.map((it) => widgetRegistry[it.type]?.label ?? it.type)
  return [...new Set(labels)].join(' · ')
}

/** 프리셋 목록 → 하나 고르면 적용 방식 확인 → 적용. */
export function PresetDialog({ activeCount, onApply, onClose }: Props) {
  const [presets, setPresets] = useState<Preset[] | null>(null)
  const [error, setError] = useState('')
  const [picked, setPicked] = useState<Preset | null>(null)
  const [mode, setMode] = useState<ApplyMode>('archive')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    listPresets()
      .then((p) => !cancelled && setPresets(p))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : '알 수 없는 오류'))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  async function confirm() {
    if (!picked) return
    setBusy(true)
    setError('')
    try {
      await onApply(picked, mode)
      onClose()
    } catch (e) {
      console.error(e)
      setError(`적용하지 못했어요. 기존 위젯은 그대로예요. (${e instanceof Error ? e.message : '알 수 없는 오류'})`)
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <section className="panel modal" role="dialog" aria-modal="true" aria-label="프리셋">
        <div className="archive-head">
          <strong>{picked ? `“${picked.name}” 적용` : '프리셋'}</strong>
          <button type="button" className="icon-btn" aria-label="닫기" disabled={busy} onClick={onClose}>
            ×
          </button>
        </div>

        {!picked && (
          <>
            <p className="muted">용도에 맞는 위젯 세트를 골라 한 번에 만들어요. 기록은 비어 있는 상태로 시작해요.</p>
            {!presets && !error && <p className="muted">불러오는 중…</p>}
            {presets && presets.length === 0 && <p className="muted">사용할 수 있는 프리셋이 없어요.</p>}
            <ul className="archive-list">
              {presets?.map((p) => (
                <li key={p.id} className="archive-item">
                  <div className="archive-info">
                    <strong>{p.name}</strong>
                    <span className="muted">{p.description}</span>
                    <span className="muted">위젯 {p.layout.length}개 · {kinds(p)}</span>
                  </div>
                  <button type="button" className="btn sm" onClick={() => setPicked(p)}>
                    선택
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {picked && (
          <>
            <p className="muted">위젯 {picked.layout.length}개를 만들어요. 어떻게 적용할까요?</p>
            <label className="radio-row">
              <input type="radio" name="mode" checked={mode === 'archive'} disabled={busy} onChange={() => setMode('archive')} />
              <span>
                <strong>기존 위젯을 보관하고 적용 (기본)</strong>
                <span className="muted">
                  지금 보이는 위젯 {activeCount}개를 보관함으로 옮겨요. 기록은 그대로 남고 보관함에서 복원할 수 있어요.
                </span>
              </span>
            </label>
            <label className="radio-row">
              <input type="radio" name="mode" checked={mode === 'append'} disabled={busy} onChange={() => setMode('append')} />
              <span>
                <strong>기존 위젯은 그대로 두고 추가</strong>
                <span className="muted">기존 위젯은 건드리지 않고, 빈 자리에 겹치지 않게 덧붙여요.</span>
              </span>
            </label>
            <p className="muted">어느 쪽이든 위젯이나 기록을 삭제하지 않아요.</p>
            <div className="modal-actions">
              <button type="button" className="btn ghost" disabled={busy} onClick={() => setPicked(null)}>
                뒤로
              </button>
              <button type="button" className="btn" disabled={busy} onClick={() => void confirm()}>
                {busy ? '적용 중…' : '적용'}
              </button>
            </div>
          </>
        )}

        {error && <p className="error">{error}</p>}
      </section>
    </div>
  )
}
