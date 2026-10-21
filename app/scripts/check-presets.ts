// 프리셋 검증 스크립트: `npm run check:presets` (node --experimental-strip-types 사용)
//  1) 마이그레이션 SQL의 시드 JSON이 유효하고 schema.sql과 같은지, 위젯 종류가 registry에 있는지, data 키가 없는지
//  2) lg 배치가 12칸을 빈 구멍·겹침 없이 채우는지
//  3) md/sm 자동 계산 결과가 겹치지 않고 칸 수를 넘지 않는지
//  4) 기존 위젯이 있을 때(append) 새 위젯이 기존 위젯과 겹치지 않는지 (무작위 100회)
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { layoutPreset } from '../src/core/presetLayout.ts'
import { overlaps } from '../src/core/placement.ts'
import type { LayoutItem, PresetItem, WidgetLayout } from '../src/core/types.ts'

const COLS = { lg: 12, md: 6, sm: 1 } as const
const KEYS = ['lg', 'md', 'sm'] as const
const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')

const migration = read('../supabase/migrations/20261022_presets.sql')
const schema = read('../supabase/schema.sql')
const registryKeys = new Set([...read('../src/widgets/registry.ts').matchAll(/^ {2}(\w+): \{$/gm)].map((m) => m[1]))
const seeds = (sql: string) => [...sql.matchAll(/\$preset\$([\s\S]*?)\$preset\$/g)].map((m) => m[1])

let failures = 0
function check(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS  ${name}`)
  } catch (e) {
    failures++
    console.log(`FAIL  ${name}\n      ${(e as Error).message}`)
  }
}

const presets = seeds(migration).map((s) => JSON.parse(s) as PresetItem[])
const names = ['취업 준비', '공부·학습', '습관·루틴']

check('시드 3개, schema.sql과 동일', () => {
  assert.equal(presets.length, 3)
  assert.deepEqual(seeds(schema).map((s) => JSON.parse(s)), presets)
})

presets.forEach((items, n) => {
  check(`[${names[n]}] 위젯 종류·data 키`, () => {
    for (const it of items) {
      assert.ok(registryKeys.has(it.type), `registry에 없는 type: ${it.type}`)
      assert.ok(!('data' in it), `${it.title}: data 키가 있음`)
      assert.ok(it.title.length > 0)
    }
  })

  check(`[${names[n]}] lg 12칸이 빈 구멍·겹침 없이 채워짐`, () => {
    const height = Math.max(...items.map((it) => it.y + it.h))
    const grid = Array.from({ length: height }, () => Array<number>(12).fill(0))
    for (const it of items) {
      assert.ok(it.x >= 0 && it.x + it.w <= 12, `${it.title}: 칸 밖`)
      for (let y = it.y; y < it.y + it.h; y++) for (let x = it.x; x < it.x + it.w; x++) grid[y][x]++
    }
    for (let y = 0; y < height; y++) for (let x = 0; x < 12; x++) assert.equal(grid[y][x], 1, `(${x},${y}) 칸이 ${grid[y][x]}번 덮임`)
  })

  check(`[${names[n]}] 빈 대시보드에 적용: lg는 원본 그대로, md/sm은 겹침·범위 없음`, () => {
    const out = layoutPreset(items, [], COLS)
    items.forEach((it, i) => assert.deepEqual(out[i].lg, { x: it.x, y: it.y, w: it.w, h: it.h }))
    for (const key of KEYS) assertNoOverlap(out.map((l) => l[key]!), COLS[key], `${key}`)
  })
})

function assertNoOverlap(list: LayoutItem[], cols: number, label: string) {
  list.forEach((a, i) => {
    assert.ok(a && a.x >= 0 && a.y >= 0 && a.x + a.w <= cols, `${label}: 범위 밖 ${JSON.stringify(a)}`)
    list.slice(i + 1).forEach((b) => assert.ok(!overlaps(a, b), `${label}: 겹침 ${JSON.stringify(a)} / ${JSON.stringify(b)}`))
  })
}

check('기존 위젯이 있을 때(append) 무작위 100회: 기존·새 위젯 모두 겹침 없음', () => {
  let seed = 12345
  const rnd = (n: number) => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff), seed % n)
  for (let round = 0; round < 100; round++) {
    const items = presets[round % 3]
    // 기존 위젯 0~8개를 서로 겹치지 않게 아무 곳에나 둔다.
    const existing: WidgetLayout[] = []
    const count = rnd(9)
    for (let c = 0; c < count; c++) {
      const l: WidgetLayout = {}
      for (const key of KEYS) {
        const taken = existing.flatMap((e) => (e[key] ? [e[key]!] : []))
        for (let tries = 0; tries < 20; tries++) {
          const w = 1 + rnd(Math.min(6, COLS[key]))
          const cand = { x: rnd(COLS[key] - w + 1), y: rnd(30), w: Math.min(w, COLS[key]), h: 3 + rnd(8) }
          if (!taken.some((t) => overlaps(cand, t))) {
            l[key] = cand
            break
          }
        }
      }
      existing.push(l)
    }
    const out = layoutPreset(items, existing, COLS)
    for (const key of KEYS) {
      const all = [...existing.flatMap((e) => (e[key] ? [e[key]!] : [])), ...out.map((l) => l[key]!)]
      assertNoOverlap(all, COLS[key], `round ${round} ${key}`)
    }
  }
})

console.log(failures === 0 ? '\n모두 통과' : `\n${failures}개 실패`)
process.exit(failures === 0 ? 0 : 1)
