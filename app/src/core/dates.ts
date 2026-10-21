// 날짜 유틸. 여러 위젯(습관, 잔디, 캘린더 등)이 같이 쓴다.
// 날짜는 항상 'YYYY-MM-DD' 문자열 키로 저장한다. (시간대 문제를 피하려고 Date 객체를 저장하지 않는다)

export const DOW = ['일', '월', '화', '수', '목', '금', '토']

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n)
}

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() + n)
  return x
}

/** 그 날짜가 속한 주의 월요일 */
export function mondayOf(d: Date): Date {
  return addDays(d, -((d.getDay() + 6) % 7))
}

export function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

/** 'YYYY-MM-DD' 문자열을 그날 0시(로컬)의 Date로. 형식이 틀리면 null */
export function parseKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

/** 오늘부터 그 날짜까지 남은 일수. 오늘이면 0, 지났으면 음수 */
export function daysUntil(key: string): number | null {
  const target = parseKey(key)
  if (!target) return null
  const t = new Date()
  const today = new Date(t.getFullYear(), t.getMonth(), t.getDate())
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}
