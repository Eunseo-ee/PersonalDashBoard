import type { ComponentType } from 'react'
import type { Breakpoint } from '../core/types'
import { HabitWidget } from './habit/HabitWidget'
import { TodoWidget } from './todo/TodoWidget'
import type { WidgetProps } from './types'

// 위젯 종류 등록소.
// 새 위젯을 만들 때: widgets/<종류>/ 폴더에 컴포넌트를 만들고 여기에 항목 하나만 추가한다.
// DB의 app_widgets.type 값이 이 객체의 키와 같아야 화면에 그려진다.

export interface WidgetDefinition {
  label: string
  /** 새로 추가할 때의 크기. 화면 구간(lg/md/sm)별로 따로 정한다. 단위는 그리드 칸. */
  defaultSize: Record<Breakpoint, { w: number; h: number }>
  defaultConfig: Record<string, unknown>
  defaultData: Record<string, unknown>
  component: ComponentType<WidgetProps>
}

export const widgetRegistry: Record<string, WidgetDefinition> = {
  todo: {
    label: '할 일',
    defaultSize: { lg: { w: 4, h: 7 }, md: { w: 3, h: 7 }, sm: { w: 1, h: 7 } },
    defaultConfig: { title: '할 일' },
    defaultData: { items: [] },
    component: TodoWidget,
  },
  habit: {
    label: '습관',
    defaultSize: { lg: { w: 6, h: 9 }, md: { w: 6, h: 9 }, sm: { w: 1, h: 9 } },
    defaultConfig: { title: '습관 트래커' },
    defaultData: { habits: [], checks: {} },
    component: HabitWidget,
  },
}
