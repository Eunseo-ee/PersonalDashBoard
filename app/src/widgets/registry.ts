import type { ComponentType } from 'react'
import type { Breakpoint } from '../core/types'
import { ChartWidget } from './chart/ChartWidget'
import { CounterWidget } from './counter/CounterWidget'
import { DdayWidget } from './dday/DdayWidget'
import { GoalsWidget } from './goals/GoalsWidget'
import { GrassWidget } from './grass/GrassWidget'
import { HabitWidget } from './habit/HabitWidget'
import { LinksWidget } from './links/LinksWidget'
import { NoteWidget } from './note/NoteWidget'
import { PieWidget } from './pie/PieWidget'
import { StatusWidget } from './status/StatusWidget'
import { TimerWidget } from './timer/TimerWidget'
import { TodoWidget } from './todo/TodoWidget'
import type { WidgetProps } from './types'

// 위젯 종류 등록소.
// 새 위젯을 만들 때: widgets/<종류>/ 폴더에 컴포넌트를 만들고 여기에 항목 하나만 추가한다.
// DB의 app_widgets.type 값이 이 객체의 키와 같아야 화면에 그려진다.

export interface WidgetDefinition {
  label: string
  /** 추가 메뉴에 보이는 한 줄 설명 */
  description: string
  /** 새로 추가할 때의 크기. 화면 구간(lg/md/sm)별로 따로 정한다. 단위는 그리드 칸. */
  defaultSize: Record<Breakpoint, { w: number; h: number }>
  defaultConfig: Record<string, unknown>
  defaultData: Record<string, unknown>
  /** true면 제목 옆에 "+" 버튼이 생기고, 위젯은 adding 값에 따라 추가 입력란을 보여 준다. */
  hasAdd?: boolean
  component: ComponentType<WidgetProps>
}

export const widgetRegistry: Record<string, WidgetDefinition> = {
  todo: {
    label: '할 일',
    description: '체크하며 지워 나가는 할 일 목록',
    defaultSize: { lg: { w: 4, h: 7 }, md: { w: 3, h: 7 }, sm: { w: 1, h: 7 } },
    defaultConfig: { title: '할 일' },
    defaultData: { items: [] },
    hasAdd: true,
    component: TodoWidget,
  },
  habit: {
    label: '습관',
    description: '주·월 단위로 매일 했는지 체크',
    defaultSize: { lg: { w: 6, h: 9 }, md: { w: 6, h: 9 }, sm: { w: 1, h: 9 } },
    defaultConfig: { title: '습관 트래커' },
    defaultData: { habits: [], checks: {} },
    hasAdd: true,
    component: HabitWidget,
  },
  pie: {
    label: '원형 그래프',
    description: '항목별 비율을 도넛 그래프로 보기',
    defaultSize: { lg: { w: 4, h: 8 }, md: { w: 3, h: 8 }, sm: { w: 1, h: 8 } },
    defaultConfig: { title: '원형 그래프' },
    defaultData: { slices: [] },
    hasAdd: true,
    component: PieWidget,
  },
  grass: {
    label: '잔디',
    description: '날마다 칸을 눌러 기록하는 활동 달력',
    defaultSize: { lg: { w: 6, h: 5 }, md: { w: 6, h: 5 }, sm: { w: 1, h: 5 } },
    defaultConfig: { title: '잔디' },
    defaultData: { levels: {} },
    component: GrassWidget,
  },
  chart: {
    label: '막대·꺾은선 그래프',
    description: '직접 입력한 값의 추세를 그래프로 보기',
    defaultSize: { lg: { w: 6, h: 9 }, md: { w: 6, h: 9 }, sm: { w: 1, h: 9 } },
    defaultConfig: { title: '그래프', kind: 'bar' },
    defaultData: { points: [] },
    hasAdd: true,
    component: ChartWidget,
  },
  goals: {
    label: '목표·진행률',
    description: '항목을 체크하면 진행률 바가 차오름',
    defaultSize: { lg: { w: 4, h: 8 }, md: { w: 3, h: 8 }, sm: { w: 1, h: 8 } },
    defaultConfig: { title: '목표' },
    defaultData: { items: [] },
    hasAdd: true,
    component: GoalsWidget,
  },
  dday: {
    label: 'D-day',
    description: '시험·마감일까지 남은 일수',
    defaultSize: { lg: { w: 4, h: 6 }, md: { w: 3, h: 6 }, sm: { w: 1, h: 6 } },
    defaultConfig: { title: 'D-day' },
    defaultData: { items: [] },
    hasAdd: true,
    component: DdayWidget,
  },
  timer: {
    label: '타이머·뽀모도로',
    description: '공부 시간을 재고 날짜별로 기록',
    defaultSize: { lg: { w: 4, h: 10 }, md: { w: 3, h: 10 }, sm: { w: 1, h: 10 } },
    defaultConfig: { title: '공부 타이머', focusMin: 25, breakMin: 5 },
    defaultData: { log: {}, running: null },
    hasAdd: true,
    component: TimerWidget,
  },
  counter: {
    label: '카운터',
    description: '숫자 하나를 크게 보여 주고 +/- 로 조절',
    defaultSize: { lg: { w: 3, h: 5 }, md: { w: 3, h: 5 }, sm: { w: 1, h: 5 } },
    defaultConfig: { title: '카운터', step: 1, unit: '' },
    defaultData: { value: 0 },
    component: CounterWidget,
  },
  note: {
    label: '메모',
    description: '자유롭게 쓰는 텍스트 칸',
    defaultSize: { lg: { w: 4, h: 6 }, md: { w: 3, h: 6 }, sm: { w: 1, h: 6 } },
    defaultConfig: { title: '메모' },
    defaultData: { text: '' },
    component: NoteWidget,
  },
  status: {
    label: '상태 목록',
    description: '편집 모드에서 적어 두고, 평소엔 보유·준비 중 같은 상태만 표시',
    defaultSize: { lg: { w: 4, h: 7 }, md: { w: 3, h: 7 }, sm: { w: 1, h: 7 } },
    defaultConfig: { title: '자격 · 스펙' },
    defaultData: { items: [] },
    component: StatusWidget,
  },
  links: {
    label: '링크 모음',
    description: '자주 가는 사이트 바로가기',
    defaultSize: { lg: { w: 4, h: 6 }, md: { w: 3, h: 6 }, sm: { w: 1, h: 6 } },
    defaultConfig: { title: '링크' },
    defaultData: { links: [] },
    hasAdd: true,
    component: LinksWidget,
  },
}
