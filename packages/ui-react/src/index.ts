/**
 * `@shishu/ui-react` 公共入口。
 *
 * 展示层与宿主解耦：这里不 import 任何 `@deepseek-ai/*`，React 由宿主提供。
 * 纯函数层（`./pure`）不依赖 React，可单独测试与复用。
 */
export { CalendarPanel } from './CalendarPanel.tsx'
export { TodayPill } from './TodayPill.tsx'
export * from './pure/index.ts'
export * from './theme.ts'
