import type { Session } from '@supabase/supabase-js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Responsive, getBreakpointFromWidth, useContainerWidth } from 'react-grid-layout'
import type { Layout, ResponsiveLayouts } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { createWidget, deleteWidget, getOrCreateDashboard, listWidgets, updateWidget } from '../core/dashboards'
import type { WidgetPatch } from '../core/dashboards'
import { supabase } from '../core/supabase'
import type { Dashboard, WidgetLayout, WidgetRow } from '../core/types'
import { widgetRegistry } from '../widgets/registry'
import type { WidgetProps } from '../widgets/types'
import { BP_KEYS, BREAKPOINTS, COLS, ROW_HEIGHT } from './grid'
import { WidgetCard } from './WidgetCard'

type SaveStatus = 'saved' | 'saving' | 'error'
const STATUS_TEXT: Record<SaveStatus, string> = {
  saved: '저장됨',
  saving: '저장 중…',
  error: '저장하지 못했어요. 잠시 후 다시 시도해 주세요',
}

export function DashboardPage({ session }: { session: Session }) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [widgets, setWidgets] = useState<WidgetRow[]>([])
  const [loadError, setLoadError] = useState('')
  const [editing, setEditing] = useState(false)
  const [status, setStatus] = useState<SaveStatus>('saved')
  const { width, containerRef, mounted } = useContainerWidth()
  const bp = getBreakpointFromWidth(BREAKPOINTS, width)

  // 화면 상태와 같은 값을 ref에도 들고 있어서, 이벤트 핸들러가 항상 최신 목록을 본다.
  const widgetsRef = useRef<WidgetRow[]>([])
  const pendingRef = useRef(new Map<string, { patch: WidgetPatch; timer: number }>())

  function updateWidgets(fn: (prev: WidgetRow[]) => WidgetRow[]) {
    const next = fn(widgetsRef.current)
    widgetsRef.current = next
    setWidgets(next)
  }

  // ---------- 불러오기 ----------
  useEffect(() => {
    let cancelled = false
    getOrCreateDashboard(session.user.id)
      .then(async (d) => {
        const rows = await listWidgets(d.id)
        if (cancelled) return
        setDashboard(d)
        widgetsRef.current = rows
        setWidgets(rows)
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : '알 수 없는 오류')
      })
    return () => {
      cancelled = true
    }
  }, [session.user.id])

  // ---------- 저장 (위젯별로 모아서 0.5초 뒤 한 번에) ----------
  async function flush(id: string) {
    const cur = pendingRef.current.get(id)
    if (!cur) return
    pendingRef.current.delete(id)
    try {
      await updateWidget(id, cur.patch)
      if (pendingRef.current.size === 0) setStatus('saved')
    } catch (e) {
      console.error(e)
      setStatus('error')
    }
  }

  function persist(id: string, patch: WidgetPatch) {
    const cur = pendingRef.current.get(id)
    if (cur) window.clearTimeout(cur.timer)
    const timer = window.setTimeout(() => void flush(id), 500)
    pendingRef.current.set(id, { patch: { ...(cur?.patch ?? {}), ...patch }, timer })
    setStatus('saving')
  }

  // 탭을 닫거나 숨기기 직전에 아직 저장 안 된 내용을 보낸다.
  useEffect(() => {
    const pending = pendingRef.current
    const onHide = () => {
      if (document.visibilityState !== 'hidden') return
      for (const [id, cur] of pending) {
        window.clearTimeout(cur.timer)
        void flush(id)
      }
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------- 위젯 조작 ----------
  const changeWidget: (id: string, patch: Parameters<WidgetProps['onChange']>[0]) => void = (id, patch) => {
    updateWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, config: patch.config ?? w.config, data: patch.data ?? w.data } : w)),
    )
    persist(id, patch)
  }

  async function addWidget(type: string) {
    const def = widgetRegistry[type]
    if (!dashboard || !def) return
    // 화면 구간마다 맨 아래에 붙인다.
    const layout: WidgetLayout = {}
    for (const key of BP_KEYS) {
      const bottom = widgetsRef.current.reduce((m, w) => {
        const l = w.layout[key]
        return l ? Math.max(m, l.y + l.h) : m
      }, 0)
      const size = def.defaultSize[key]
      layout[key] = { x: 0, y: bottom, w: Math.min(size.w, COLS[key]), h: size.h }
    }
    try {
      setStatus('saving')
      const row = await createWidget(dashboard.id, type, def.defaultConfig, def.defaultData, layout)
      updateWidgets((prev) => [...prev, row])
      setStatus('saved')
    } catch (e) {
      console.error(e)
      setStatus('error')
    }
  }

  async function removeWidget(id: string) {
    if (!window.confirm('이 위젯을 삭제할까요? 안의 내용도 함께 사라져요.')) return
    const cur = pendingRef.current.get(id)
    if (cur) window.clearTimeout(cur.timer)
    pendingRef.current.delete(id)
    updateWidgets((prev) => prev.filter((w) => w.id !== id))
    try {
      await deleteWidget(id)
    } catch (e) {
      console.error(e)
      setStatus('error')
    }
  }

  // 드래그/리사이즈가 끝났을 때만 저장한다. 지금 보고 있는 화면 구간(bp)의 배치만 바꾸고,
  // 다른 구간(예: 모바일)의 배치는 건드리지 않는다.
  function onLayoutStop(layout: Layout) {
    const changed: WidgetRow[] = []
    const next = widgetsRef.current.map((w) => {
      const it = layout.find((l) => l.i === w.id)
      if (!it) return w
      const old = w.layout[bp]
      if (old && old.x === it.x && old.y === it.y && old.w === it.w && old.h === it.h) return w
      const updated = { ...w, layout: { ...w.layout, [bp]: { x: it.x, y: it.y, w: it.w, h: it.h } } }
      changed.push(updated)
      return updated
    })
    if (changed.length === 0) return
    updateWidgets(() => next)
    for (const w of changed) persist(w.id, { layout: w.layout })
  }

  // 저장된 배치를 그리드가 이해하는 형태로 바꾼다. 저장된 적 없는 구간은 그리드가 알아서 만들어 준다.
  const layouts = useMemo(() => {
    const out: ResponsiveLayouts = {}
    for (const key of BP_KEYS) {
      const items = widgets.flatMap((w) => {
        const l = w.layout[key]
        return l ? [{ i: w.id, x: l.x, y: l.y, w: l.w, h: l.h, minW: 1, minH: 3 }] : []
      })
      if (items.length > 0) out[key] = items
    }
    return out
  }, [widgets])

  return (
    <div className="page">
      <header className="panel topbar">
        <div>
          <strong>{dashboard?.name ?? 'My Dashboard'}</strong>
          <div className="muted">{session.user.email}</div>
        </div>
        <div className="topbar-tools">
          <span className="muted save-status" data-s={status} role="status">{STATUS_TEXT[status]}</span>
          {Object.entries(widgetRegistry).map(([type, def]) => (
            <button key={type} className="btn ghost" disabled={!dashboard} onClick={() => void addWidget(type)}>
              + {def.label}
            </button>
          ))}
          <button className={editing ? 'btn' : 'btn ghost'} onClick={() => setEditing((v) => !v)}>
            {editing ? '편집 끝내기' : '편집'}
          </button>
          <button className="btn ghost" onClick={() => supabase.auth.signOut()}>로그아웃</button>
        </div>
      </header>

      {loadError && (
        <p className="panel error">
          불러오지 못했어요: {loadError}
        </p>
      )}
      {!loadError && !dashboard && <p className="muted">불러오는 중…</p>}
      {dashboard && editing && (
        <p className="muted">위젯 제목 줄을 잡고 옮기고, 오른쪽 아래 모서리를 끌어 크기를 바꿀 수 있어요.</p>
      )}
      {dashboard && widgets.length === 0 && (
        <p className="panel muted">아직 위젯이 없어요. 위쪽의 “+ 할 일” 버튼으로 추가해 보세요.</p>
      )}

      <div ref={containerRef}>
        {mounted && dashboard && (
          <Responsive
            width={width}
            layouts={layouts}
            breakpoints={BREAKPOINTS}
            cols={COLS}
            rowHeight={ROW_HEIGHT}
            margin={[12, 12]}
            dragConfig={{ enabled: editing, handle: '.widget-handle', allowMobileScroll: true }}
            resizeConfig={{ enabled: editing }}
            onDragStop={onLayoutStop}
            onResizeStop={onLayoutStop}
          >
            {widgets.map((w) => (
              <div key={w.id}>
                <WidgetCard
                  widget={w}
                  editing={editing}
                  onChange={(patch) => changeWidget(w.id, patch)}
                  onDelete={() => void removeWidget(w.id)}
                />
              </div>
            ))}
          </Responsive>
        )}
      </div>
    </div>
  )
}
