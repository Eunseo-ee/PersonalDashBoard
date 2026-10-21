import { layoutPreset } from './presetLayout'
import { supabase } from './supabase'
import type { Breakpoint, Preset, WidgetLayout, WidgetRow } from './types'

// 프리셋 조회·적용. 화면 코드는 이 파일을 통해서만 프리셋을 다룬다. (앱으로 옮길 때 그대로 재사용)
// 프리셋은 복사해서 쓰는 템플릿이다: 적용해도 app_presets 행은 읽기만 하고 절대 수정하지 않는다.

/** 위젯 종류별 기본값. widgets/registry.ts의 항목이 그대로 들어맞는다. (core가 React 위젯을 몰라도 되게 인자로 받는다) */
export type WidgetDefaults = Record<string, { defaultConfig: Record<string, unknown>; defaultData: Record<string, unknown> }>

/**
 * archive = 지금 보이는 위젯을 모두 보관함으로 보내고 적용 (기록은 유지)
 * append  = 기존 위젯은 그대로 두고 빈 자리에 겹치지 않게 추가
 */
export type ApplyMode = 'archive' | 'append'

/** 시스템 프리셋 먼저, 그 안에서는 등록 순서. (사용자 프리셋은 RLS 덕분에 내 것만 보인다) */
export async function listPresets(): Promise<Preset[]> {
  const { data, error } = await supabase
    .from('app_presets')
    .select('*')
    .order('owner_id', { ascending: true, nullsFirst: true })
    .order('created_at')
  if (error) throw error
  return data as Preset[]
}

interface NewWidget {
  type: string
  config: Record<string, unknown>
  data: Record<string, unknown>
  layout: WidgetLayout
}

/**
 * 프리셋 → 새로 만들 위젯 목록. 프리셋에서 읽는 건 type / title / config / 위치·크기뿐이고,
 * data는 프리셋이 아니라 위젯 종류의 기본값에서 복사해 채운다. (프리셋에 data가 섞여 있어도 읽지 않는다)
 */
export function buildPresetWidgets(
  preset: Preset,
  defaults: WidgetDefaults,
  existing: WidgetLayout[],
  cols: Record<Breakpoint, number>,
): NewWidget[] {
  // 지금 앱이 모르는 위젯 종류는 건너뛴다.
  const items = preset.layout.filter((it) => defaults[it.type])
  if (items.length === 0) throw new Error('이 프리셋에는 지금 쓸 수 있는 위젯이 없어요.')
  const layouts = layoutPreset(items, existing, cols)
  return items.map((it, i) => {
    const def = defaults[it.type]
    return {
      type: it.type,
      config: { ...structuredClone(def.defaultConfig), ...structuredClone(it.config ?? {}), title: it.title },
      data: structuredClone(def.defaultData),
      layout: layouts[i],
    }
  })
}

/**
 * 프리셋 적용. 보관(status 변경)과 위젯 추가를 DB 함수 한 번으로 처리해서 중간에 실패해도 반쯤 적용되지 않는다.
 * 삭제는 하지 않는다. 호출 전에 아직 저장 안 된 변경은 먼저 저장해 두어야 한다.
 * @param active 지금 대시보드에 보이는 위젯 (append일 때 겹침 계산에 쓴다)
 * @returns 새로 만들어진 위젯들
 */
export async function applyPreset(
  dashboardId: string,
  preset: Preset,
  mode: ApplyMode,
  active: WidgetRow[],
  defaults: WidgetDefaults,
  cols: Record<Breakpoint, number>,
): Promise<WidgetRow[]> {
  const existing = mode === 'append' ? active.map((w) => w.layout) : []
  const widgets = buildPresetWidgets(preset, defaults, existing, cols)
  const { data, error } = await supabase.rpc('app_apply_preset', {
    p_dashboard_id: dashboardId,
    p_archive_existing: mode === 'archive',
    p_widgets: widgets,
  })
  if (error) throw error
  return data as WidgetRow[]
}
