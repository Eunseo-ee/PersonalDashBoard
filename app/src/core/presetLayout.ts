import type { Breakpoint, LayoutItem, PresetItem, WidgetLayout } from './types'
// node로 바로 돌려 검증할 수 있도록 확장자를 붙여 가져온다. (tsconfig: allowImportingTsExtensions)
import { findFreeSpot, overlaps } from './placement.ts'

// 프리셋(lg 12칸 기준) → 화면 구간별 배치 계산. 순수 함수라 DB·화면 없이 앱에서도 그대로 쓴다.

const KEYS: Breakpoint[] = ['lg', 'md', 'sm']

/** 구간별 폭. 작은 위젯(≤2)은 그대로, 보통(≤4)은 3칸, 그보다 넓으면 한 줄 전체. 칸 수를 넘지 않는다. */
export function widthFor(key: Breakpoint, w: number, cols: number): number {
  if (key === 'lg') return Math.min(w, cols)
  const scaled = w <= 2 ? w : w <= 4 ? 3 : cols
  return Math.min(scaled, cols)
}

/**
 * 프리셋 위젯들의 lg/md/sm 배치를 만든다. (결과는 items와 같은 순서)
 *  - lg: 프리셋에 적힌 자리를 그대로 쓴다. 이미 있는 위젯과 겹치면 그 위젯만 빈 자리로 옮긴다.
 *  - md/sm: 읽는 순서(위→아래, 왼→오)대로 빈 자리에 차례로 채운다.
 *  - existing: 겹치면 안 되는 기존 위젯들의 배치. 기존 위젯을 보관하고 적용할 때는 빈 배열.
 * c2/c1은 만들지 않는다. 기존 보기 로직이 lg 순서를 보고 알아서 정렬한다.
 */
export function layoutPreset(
  items: PresetItem[],
  existing: WidgetLayout[],
  cols: Record<Breakpoint, number>,
): WidgetLayout[] {
  const out = items.map((): WidgetLayout => ({}))
  const order = items.map((_, i) => i).sort((a, b) => items[a].y - items[b].y || items[a].x - items[b].x || a - b)

  for (const key of KEYS) {
    const taken: LayoutItem[] = existing.flatMap((l) => {
      const t = l[key]
      return t ? [t] : []
    })
    for (const i of order) {
      const it = items[i]
      const w = widthFor(key, it.w, cols[key])
      let spot: LayoutItem
      if (key === 'lg') {
        const want = { x: Math.min(it.x, cols.lg - w), y: it.y, w, h: it.h }
        spot = taken.some((t) => overlaps(want, t)) ? findFreeSpot(w, it.h, cols.lg, taken) : want
      } else {
        spot = findFreeSpot(w, it.h, cols[key], taken)
      }
      out[i][key] = spot
      taken.push(spot)
    }
  }
  return out
}
