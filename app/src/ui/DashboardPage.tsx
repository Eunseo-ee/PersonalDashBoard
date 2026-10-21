import type { Session } from '@supabase/supabase-js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Responsive, getBreakpointFromWidth, useContainerWidth } from 'react-grid-layout'
import type { Layout, ResponsiveLayouts } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import {
  archiveWidget,
  createWidget,
  deleteWidget,
  getOrCreateDashboard,
  listArchivedWidgets,
  listWidgets,
  restoreWidget,
  updateWidget,
} from '../core/dashboards'
import type { WidgetPatch } from '../core/dashboards'
import { supabase } from '../core/supabase'
import type { Dashboard, LayoutKey, WidgetLayout, WidgetRow } from '../core/types'
import { widgetRegistry } from '../widgets/registry'
import type { WidgetProps } from '../widgets/types'
import { AddWidgetMenu } from './AddWidgetMenu'
import { ArchivePanel } from './ArchivePanel'
import { BP_KEYS, BREAKPOINTS, COLS, FORCE_1COL_BELOW, LAYOUT_COLS, ROW_HEIGHT, VIEW_STORAGE_KEY } from './grid'
import type { ViewMode } from './grid'
import { WidgetCard } from './WidgetCard'

type SaveStatus = 'saved' | 'saving' | 'error'
const STATUS_TEXT: Record<SaveStatus, string> = {
  saved: '저장됨',
  saving: '저장 중…',
  error: '저장하지 못했어요. 잠시 후 다시 시도해 주세요',
}

function loadViewMode(): ViewMode {
  try {
    const v = localStorage.getItem(VIEW_STORAGE_KEY)
    return v === '2col' || v === '1col' ? v : 'free'
  } catch {
    return 'free'
  }
}

interface GridItem {
  i: string
  x: number
  y: number
  w: number
  h: number
  minW: number
  minH: number
}

export function DashboardPage({ session }: { session: Session }) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [widgets, setWidgets] = useState<WidgetRow[]>([])
  const [archived, setArchived] = useState<WidgetRow[]>([])
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState('')
  const [editing, setEditing] = useState(false)
  const [status, setStatus] = useState<SaveStatus>('saved')
  const { width, containerRef, mounted } = useContainerWidth()
  const bp = getBreakpointFromWidth(BREAKPOINTS, width)
  const [viewMode, setViewModeState] = useState<ViewMode>(loadViewMode)

  function setViewMode(next: ViewMode) {
    setViewModeState(next)
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next)
    } catch {
      // 저장이 막힌 환경이면 이번 방문에만 적용된다.
    }
  }

  // 지금 실제로 쓰는 배치 종류.
  //  - 좁은 화면: 무조건 1col
  //  - 2col / 1col 버튼을 켰으면 그대로
  //  - 아니면 자유 배치(화면 폭에 따라 lg/md)
  const forced1 = mounted && width < FORCE_1COL_BELOW
  const gridKey: LayoutKey = forced1 || viewMode === '1col' ? 'c1' : viewMode === '2col' ? 'c2' : bp
  const fixedCols = gridKey === 'c2' ? 2 : gridKey === 'c1' ? 1 : 0
  // 크기 조절은 넓은 화면의 자유 배치(lg)에서만 켠다. 반절 화면·2col·1col에서는 끈다.
  const canResize = editing && fixedCols === 0 && gridKey === 'lg'

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
        const [rows, archivedRows] = await Promise.all([listWidgets(d.id), listArchivedWidgets(d.id)])
        if (cancelled) return
        setDashboard(d)
        widgetsRef.current = rows
        setWidgets(rows)
        setArchived(archivedRows)
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

  /** 아직 DB로 안 보낸 변경을 대기열에서 꺼낸다. (보관할 땐 함께 보내고, 삭제할 땐 버린다) */
  function takePending(id: string): WidgetPatch | undefined {
    const cur = pendingRef.current.get(id)
    if (!cur) return undefined
    window.clearTimeout(cur.timer)
    pendingRef.current.delete(id)
    return cur.patch
  }

  // 보관: 화면에서만 빼고 기록은 DB에 그대로 둔다.
  async function archive(id: string) {
    const target = widgetsRef.current.find((w) => w.id === id)
    if (!target) return
    const unsaved = takePending(id)
    updateWidgets((prev) => prev.filter((w) => w.id !== id))
    try {
      setStatus('saving')
      const row = await archiveWidget(id, unsaved)
      setArchived((prev) => [row, ...prev])
      setStatus('saved')
    } catch (e) {
      console.error(e)
      // 보관에 실패하면 화면에 되돌려 놓는다. (사라진 것처럼 보이지 않게)
      updateWidgets((prev) => [...prev, target])
      if (unsaved) persist(id, unsaved)
      setStatus('error')
    }
  }

  // 완전 삭제: 위젯과 그 기록을 DB에서 지운다. 대시보드·보관함 어디서 지우든 같은 확인을 거친다.
  async function remove(widget: WidgetRow) {
    if (!window.confirm('이 위젯을 완전히 삭제할까요?\n이 위젯의 기록도 모두 영구 삭제됩니다. 되돌릴 수 없어요.')) return
    takePending(widget.id)
    const shown = widgetsRef.current.find((w) => w.id === widget.id)
    const wasActive = shown !== undefined
    if (wasActive) updateWidgets((prev) => prev.filter((w) => w.id !== widget.id))
    setBusyId(widget.id)
    try {
      await deleteWidget(widget.id)
      if (!wasActive) setArchived((prev) => prev.filter((w) => w.id !== widget.id))
    } catch (e) {
      console.error(e)
      if (shown) updateWidgets((prev) => [...prev, shown])
      setStatus('error')
    } finally {
      setBusyId(null)
    }
  }

  // 복원: 원래 위치·크기·설정 그대로. 원래 자리가 차 있으면 빈 자리로 옮겨 준다.
  async function restore(widget: WidgetRow) {
    setBusyId(widget.id)
    try {
      setStatus('saving')
      const row = await restoreWidget(widget, widgetsRef.current, LAYOUT_COLS)
      setArchived((prev) => prev.filter((w) => w.id !== widget.id))
      updateWidgets((prev) => [...prev, row])
      setStatus('saved')
    } catch (e) {
      console.error(e)
      setStatus('error')
    } finally {
      setBusyId(null)
    }
  }

  // 드래그/리사이즈가 끝났을 때만 저장한다. 지금 보고 있는 화면 구간(bp)의 배치만 바꾸고,
  // 다른 구간(예: 모바일)의 배치는 건드리지 않는다.
  function onLayoutStop(layout: Layout) {
    const changed: WidgetRow[] = []
    const next = widgetsRef.current.map((w) => {
      const it = layout.find((l) => l.i === w.id)
      if (!it) return w
      if (fixedCols > 0) {
        // 2col/1col: 폭과 높이는 정해져 있으니 위치(x, y)만 비교·저장한다.
        const shown = gridItems.find((g) => g.i === w.id)
        if (shown && shown.x === it.x && shown.y === it.y) return w
      } else {
        const old = w.layout[gridKey]
        if (old && old.x === it.x && old.y === it.y && old.w === it.w && old.h === it.h) return w
      }
      const updated = { ...w, layout: { ...w.layout, [gridKey]: { x: it.x, y: it.y, w: it.w, h: it.h } } }
      changed.push(updated)
      return updated
    })
    if (changed.length === 0) return
    updateWidgets(() => next)
    for (const w of changed) persist(w.id, { layout: w.layout })
  }

  // 2col/1col 배치: 순서는 저장된 위치(없으면 자유 배치의 위치)를 따르고,
  // 폭은 칸 하나, 높이는 자유 배치(lg)에서 정한 높이를 그대로 쓴다.
  const gridItems = useMemo<GridItem[]>(() => {
    if (fixedCols === 0) return []
    const key = fixedCols === 2 ? 'c2' : 'c1'
    const rank = (w: WidgetRow) => {
      const own = w.layout[key]
      const base = w.layout.lg ?? w.layout.md ?? w.layout.sm
      return own ? own.y * 10 + own.x : base ? 1e5 + base.y * 10 + base.x : 1e9
    }
    const sorted = [...widgets].sort((a, b) => rank(a) - rank(b) || a.created_at.localeCompare(b.created_at))
    return sorted.map((w, idx) => {
      const own = w.layout[key]
      const h = (w.layout.lg ?? w.layout.md ?? w.layout.sm)?.h ?? 8
      return own
        ? { i: w.id, x: Math.min(own.x, fixedCols - 1), y: own.y, w: 1, h, minW: 1, minH: 3 }
        : { i: w.id, x: idx % fixedCols, y: 1e4 + idx, w: 1, h, minW: 1, minH: 3 }
    })
  }, [widgets, fixedCols])

  // 자유 배치용: 저장된 배치를 그리드가 이해하는 형태로 바꾼다. 저장된 적 없는 구간은 그리드가 알아서 만들어 준다.
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
          <div className="seg" role="group" aria-label="보기 방식">
            <button
              type="button"
              className={gridKey === 'c2' ? 'on' : ''}
              aria-pressed={gridKey === 'c2'}
              disabled={forced1}
              title="위젯을 화면의 반씩, 한 줄에 두 개"
              onClick={() => setViewMode(viewMode === '2col' ? 'free' : '2col')}
            >
              2col
            </button>
            <button
              type="button"
              className={gridKey === 'c1' ? 'on' : ''}
              aria-pressed={gridKey === 'c1'}
              disabled={forced1}
              title="위젯을 한 줄에 하나씩"
              onClick={() => setViewMode(viewMode === '1col' ? 'free' : '1col')}
            >
              1col
            </button>
          </div>
          <AddWidgetMenu disabled={!dashboard} onPick={(type) => void addWidget(type)} />
          <button
            type="button"
            className={archiveOpen ? 'btn' : 'btn ghost'}
            aria-expanded={archiveOpen}
            disabled={!dashboard}
            onClick={() => setArchiveOpen((v) => !v)}
          >
            보관함{archived.length > 0 ? ` (${archived.length})` : ''}
          </button>
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
      {dashboard && archiveOpen && (
        <ArchivePanel
          widgets={archived}
          busyId={busyId}
          onRestore={(w) => void restore(w)}
          onDelete={(w) => void remove(w)}
          onClose={() => setArchiveOpen(false)}
        />
      )}
      {dashboard && editing && (
        <p className="muted">
          위젯 제목 줄을 잡고 옮길 수 있어요.
          {canResize
            ? ' 오른쪽 아래 모서리를 끌어 크기도 바꿀 수 있어요.'
            : ' 이 화면 배치에서는 크기 조절이 꺼져 있어요. (넓은 화면의 자유 배치에서만 가능)'}
        </p>
      )}
      {dashboard && widgets.length === 0 && (
        <p className="panel muted">아직 위젯이 없어요. 위쪽의 “+ 추가” 버튼에서 위젯을 골라 보세요.</p>
      )}

      <div ref={containerRef}>
        {mounted && dashboard && (
          <Responsive
            // 자유 배치 ↔ 고정 열 보기를 오갈 때는 그리드를 새로 만든다.
            key={fixedCols === 0 ? 'free' : gridKey}
            width={width}
            layouts={fixedCols === 0 ? layouts : { [gridKey]: gridItems }}
            breakpoints={fixedCols === 0 ? BREAKPOINTS : { [gridKey]: 0 }}
            cols={fixedCols === 0 ? COLS : { [gridKey]: fixedCols }}
            rowHeight={ROW_HEIGHT}
            margin={[12, 12]}
            containerPadding={[0, 0]}
            dragConfig={{ enabled: editing, handle: '.widget-handle', allowMobileScroll: true }}
            resizeConfig={{ enabled: canResize }}
            onDragStop={onLayoutStop}
            onResizeStop={onLayoutStop}
          >
            {widgets.map((w) => (
              <div key={w.id}>
                <WidgetCard
                  widget={w}
                  editing={editing}
                  onChange={(patch) => changeWidget(w.id, patch)}
                  onArchive={() => void archive(w.id)}
                  onDelete={() => void remove(w)}
                />
              </div>
            ))}
          </Responsive>
        )}
      </div>
    </div>
  )
}
