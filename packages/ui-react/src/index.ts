/**
 * `@shishu/ui-react` 公共入口。
 *
 * 展示层与宿主解耦：这里不 import 任何 `@deepseek-ai/*`，React 由宿主提供。
 * 纯函数层（`./pure`）不依赖 React，可单独测试与复用。
 *
 * 0.3.0 组件：
 * - {@link CalendarPanel}：中央整页月历 + 当日一屏（历史叙事轮播：多条、日期口径标签、
 *   8 秒自动播放、悬停/聚焦暂停、`←`/`→` 键盘切换）；
 * - {@link MiniCalendar}：左下角常驻紧凑月历（可拖动 / 可收起 / 可切年月）；
 * - {@link HuaxiaSettingsSection}：设置页里的「华夏日历」分区（入口从左侧栏移到这里）。
 *
 * 右下角的「今日」浮标已在 0.2.0 删除，由左下角月历取代。
 */
export { CalendarPanel } from './CalendarPanel.tsx'
export { HuaxiaSettingsSection, type HuaxiaSettingsSectionProps } from './SettingsCard.tsx'
export { MiniCalendar, type MiniCalendarProps } from './MiniCalendar.tsx'
export {
  createMiniCalendarStore,
  defaultMiniPrefs,
  useMiniCalendarPrefs,
  type CreateMiniCalendarStoreOptions,
  type MiniCalendarStore,
  type StorageLike,
} from './miniStore.ts'
export * from './pure/index.ts'
export * from './theme.ts'
