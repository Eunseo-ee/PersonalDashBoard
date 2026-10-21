// 모든 위젯 컴포넌트가 받는 공통 props.
// 위젯은 자기 config/data만 알면 되고, DB나 그리드는 몰라도 된다.

export interface WidgetProps {
  config: Record<string, unknown>
  data: Record<string, unknown>
  /** 바뀐 부분만 넘기면 화면에 바로 반영되고 DB에는 자동 저장된다. */
  onChange: (patch: { config?: Record<string, unknown>; data?: Record<string, unknown> }) => void
  /** 대시보드가 편집 모드인지 */
  editing: boolean
  /** 제목 옆 "+" 버튼이 켜져 있는지. 추가 입력란은 이 값이 true일 때만 보여 준다. */
  adding: boolean
}
