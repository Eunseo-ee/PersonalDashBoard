// 위젯 종류 등록소.
// 앞으로 위젯을 만들 때마다 widgets/<종류>/ 폴더를 만들고 여기에 한 줄 추가한다.
//   예) todo: { label: '할 일', defaultLayout: { w: 4, h: 4 }, component: TodoWidget }
//
// DB의 app_widgets.type 값이 이 객체의 키와 같아야 화면에 그려진다.

export interface WidgetDefinition {
  label: string
  defaultLayout: { w: number; h: number }
}

export const widgetRegistry: Record<string, WidgetDefinition> = {}
