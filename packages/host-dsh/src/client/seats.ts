/**
 * 席位映射表。
 *
 * slot 名与注册元数据属于 **DSH 版本契约**（rc.1 → rc.4 已在连发），所以集中
 * 在这一张表里：宿主升级时只改这里，`verify.mjs` 的断言也按这张表核对。
 *
 * - `sidebar.panellist`：左侧栏的导航行（`id` 必须等于 `main` 的 key，点击才跳得过去）
 * - `main`：中央主区，keyed 席位，root 作用域（拿不到会话数据，日历也不需要）
 * - `shell.overlay`：框架级浮层，list 席位，本身点击穿透（TodayPill 自己开 pointer-events）
 */
export const PANEL_ID = 'huaxia-calendar'

/** bundle id 必须与包名一致（spike 已验证的约定）。 */
export const PLUGIN_NAME = 'huaxia-calendar-dsh'

export const SEATS = {
  sidebar: {
    name: 'sidebar.panellist',
    id: PANEL_ID,
    order: 100,
    label: '华夏日历',
  },
  main: {
    name: 'main',
    key: PANEL_ID,
  },
  overlay: {
    name: 'shell.overlay',
    id: `${PANEL_ID}.today`,
  },
} as const
