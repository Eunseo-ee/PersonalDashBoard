import type { LayoutItem, LayoutKey, WidgetLayout, WidgetRow } from './types'

// 그리드 배치 계산(순수 함수). DB나 화면을 모르므로 앱에서도 그대로 쓸 수 있다.

function overlaps(a: LayoutItem, b: LayoutItem): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

/** 겹치지 않는 가장 위·왼쪽 빈 자리. 중간에 빈 곳이 없으면 맨 아래에 붙인다. */
function findFreeSpot(w: number, h: number, cols: number, taken: LayoutItem[]): LayoutItem {
  const bottom = taken.reduce((m, t) => Math.max(m, t.y + t.h), 0)
  for (let y = 0; y < bottom; y++) {
    for (let x = 0; x + w <= cols; x++) {
      const spot = { x, y, w, h }
      if (!taken.some((t) => overlaps(spot, t))) return spot
    }
  }
  return { x: 0, y: bottom, w, h }
}

/**
 * 복원할 위젯의 배치를 화면 구간마다 확인한다.
 * 원래 자리가 비어 있으면 그대로 두고, 다른 위젯과 겹치면 크기는 그대로 둔 채 빈 자리로 옮긴다.
 */
export function placeWithoutOverlap(
  layout: WidgetLayout,
  others: WidgetRow[],
  cols: Record<LayoutKey, number>,
): WidgetLayout {
  const out: WidgetLayout = {}
  for (const key of Object.keys(layout) as LayoutKey[]) {
    const item = layout[key]
    if (!item) continue
    const taken = others.flatMap((o) => {
      const l = o.layout[key]
      return l ? [l] : []
    })
    const w = Math.min(item.w, cols[key])
    const want = { x: Math.min(item.x, cols[key] - w), y: item.y, w, h: item.h }
    out[key] = taken.some((t) => overlaps(want, t)) ? findFreeSpot(w, item.h, cols[key], taken) : want
  }
  return out
}
