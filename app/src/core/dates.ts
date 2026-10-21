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
