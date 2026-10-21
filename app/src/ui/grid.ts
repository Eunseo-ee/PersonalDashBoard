import type { Breakpoint } from '../core/types'

// 화면 폭 구간과 칸 수. 폭이 줄어들면 칸 수가 줄고 위젯이 자동으로 재배치된다.
//   lg: 1000px 이상 12칸 / md: 640px 이상 6칸 / sm: 그 아래 1칸(세로로 쌓임)
export const BREAKPOINTS: Record<Breakpoint, number> = { lg: 1000, md: 640, sm: 0 }
export const COLS: Record<Breakpoint, number> = { lg: 12, md: 6, sm: 1 }
export const BP_KEYS: Breakpoint[] = ['lg', 'md', 'sm']
export const ROW_HEIGHT = 48
