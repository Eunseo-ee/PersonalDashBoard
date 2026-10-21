// DB 테이블(app_dashboards / app_widgets)과 1:1로 대응하는 타입.
// UI 코드와 분리해 두면 나중에 React Native 앱에서도 그대로 가져다 쓸 수 있다.

/** 화면 크기 구간. 구간마다 위치·크기를 따로 저장한다. */
export type Breakpoint = 'lg' | 'md' | 'sm'

export interface LayoutItem {
  x: number
  y: number
  w: number
  h: number
}

/**
 * 고정 열 보기. c2 = 2col(반반), c1 = 1col(한 줄씩).
 * 이 두 보기에서는 폭이 정해져 있어서 x(왼/오른쪽)와 y(순서)만 의미가 있다.
 */
export type ColMode = 'c2' | 'c1'

export type LayoutKey = Breakpoint | ColMode

export type WidgetLayout = Partial<Record<LayoutKey, LayoutItem>>

export interface Dashboard {
  id: string
  user_id: string
  name: string
  template_id: string | null
  created_at: string
  updated_at: string
}

/** active = 대시보드에 보임, archived = 보관함에 있음 (config/data/layout은 그대로 남아 있다) */
export type WidgetStatus = 'active' | 'archived'

/** type 문자열은 widgets/registry.ts에 등록된 위젯 종류와 맞춰야 한다. */
export interface WidgetRow {
  id: string
  dashboard_id: string
  user_id: string
  type: string
  config: Record<string, unknown>
  data: Record<string, unknown>
  layout: WidgetLayout
  status: WidgetStatus
  created_at: string
  updated_at: string
}

/**
 * 프리셋에 담기는 위젯 하나. 구조만 담는다 — 기록(data)은 없다.
 * 위치·크기(x, y, w, h)는 넓은 화면(lg, 12칸) 기준이고, 중간/좁은 화면 배치는 적용할 때 계산한다.
 */
export interface PresetItem {
  type: string
  title: string
  config: Record<string, unknown>
  x: number
  y: number
  w: number
  h: number
}

/** app_presets 한 행. owner_id가 null이면 시스템 프리셋, 값이 있으면 사용자 프리셋. */
export interface Preset {
  id: string
  owner_id: string | null
  name: string
  description: string
  layout: PresetItem[]
  created_at: string
}
