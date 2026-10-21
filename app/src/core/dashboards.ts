import { placeWithoutOverlap } from './placement'
import { supabase } from './supabase'
import type { Dashboard, LayoutKey, WidgetLayout, WidgetRow } from './types'

// DB 읽기/쓰기는 전부 이 파일을 거친다. 화면 코드는 supabase를 직접 부르지 않는다.
// (앱으로 옮길 때 이 파일은 그대로 재사용할 수 있다.)

const pending = new Map<string, Promise<Dashboard>>()

/** 내 첫 번째 대시보드를 가져오고, 없으면 하나 만든다. (개발 모드 이중 실행에도 중복 생성되지 않게 캐시) */
export function getOrCreateDashboard(userId: string): Promise<Dashboard> {
  let p = pending.get(userId)
  if (!p) {
    p = loadOrCreate()
    pending.set(userId, p)
    p.catch(() => pending.delete(userId))
  }
  return p
}

async function loadOrCreate(): Promise<Dashboard> {
  const found = await supabase.from('app_dashboards').select('*').order('created_at').limit(1)
  if (found.error) throw found.error
  if (found.data.length > 0) return found.data[0] as Dashboard

  const created = await supabase.from('app_dashboards').insert({ name: '내 대시보드' }).select().single()
  if (created.error) throw created.error
  return created.data as Dashboard
}

/** 대시보드에 보이는(active) 위젯만 */
export async function listWidgets(dashboardId: string): Promise<WidgetRow[]> {
  const { data, error } = await supabase
    .from('app_widgets')
    .select('*')
    .eq('dashboard_id', dashboardId)
    .eq('status', 'active')
    .order('created_at')
  if (error) throw error
  return data as WidgetRow[]
}

/** 보관함의 위젯. 최근에 보관한 것부터 (보관하면 updated_at이 갱신된다) */
export async function listArchivedWidgets(dashboardId: string): Promise<WidgetRow[]> {
  const { data, error } = await supabase
    .from('app_widgets')
    .select('*')
    .eq('dashboard_id', dashboardId)
    .eq('status', 'archived')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data as WidgetRow[]
}

export async function createWidget(
  dashboardId: string,
  type: string,
  config: Record<string, unknown>,
  data: Record<string, unknown>,
  layout: WidgetLayout,
): Promise<WidgetRow> {
  const res = await supabase
    .from('app_widgets')
    .insert({ dashboard_id: dashboardId, type, config, data, layout })
    .select()
    .single()
  if (res.error) throw res.error
  return res.data as WidgetRow
}

export type WidgetPatch = Partial<Pick<WidgetRow, 'config' | 'data' | 'layout'>>

export async function updateWidget(id: string, patch: WidgetPatch): Promise<void> {
  const { error } = await supabase.from('app_widgets').update(patch).eq('id', id)
  if (error) throw error
}

/**
 * 보관: 화면에서만 빼고 config/data/layout은 그대로 둔다.
 * 아직 저장 안 된 변경(unsaved)이 있으면 같은 요청에 실어 보내서 마지막 기록까지 남긴다.
 */
export async function archiveWidget(id: string, unsaved: WidgetPatch = {}): Promise<WidgetRow> {
  const res = await supabase
    .from('app_widgets')
    .update({ ...unsaved, status: 'archived' })
    .eq('id', id)
    .select()
    .single()
  if (res.error) throw res.error
  return res.data as WidgetRow
}

/**
 * 복원: active로 되돌린다. 원래 위치·크기·설정 그대로 돌아오고,
 * 원래 자리가 지금 보이는 위젯(active)과 겹치는 화면 구간만 빈 자리로 옮긴다.
 */
export async function restoreWidget(
  widget: WidgetRow,
  active: WidgetRow[],
  cols: Record<LayoutKey, number>,
): Promise<WidgetRow> {
  const layout = placeWithoutOverlap(widget.layout, active, cols)
  const res = await supabase
    .from('app_widgets')
    .update({ status: 'active', layout })
    .eq('id', widget.id)
    .select()
    .single()
  if (res.error) throw res.error
  return res.data as WidgetRow
}

/** 완전 삭제: 위젯 행을 지우면 그 안의 기록(data)도 함께 영구 삭제된다. */
export async function deleteWidget(id: string): Promise<void> {
  const { data, error } = await supabase.from('app_widgets').delete().eq('id', id).select('id')
  if (error) throw error
  // RLS에 막히면 오류 없이 0행이 지워지므로 직접 확인한다.
  if (data.length === 0) throw new Error('삭제할 위젯을 찾지 못했어요.')
}
