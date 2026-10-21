import { supabase } from './supabase'
import type { Dashboard, WidgetLayout, WidgetRow } from './types'

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

export async function listWidgets(dashboardId: string): Promise<WidgetRow[]> {
  const { data, error } = await supabase
    .from('app_widgets')
    .select('*')
    .eq('dashboard_id', dashboardId)
    .order('created_at')
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

export async function deleteWidget(id: string): Promise<void> {
  const { error } = await supabase.from('app_widgets').delete().eq('id', id)
  if (error) throw error
}
