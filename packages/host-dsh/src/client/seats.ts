/**
 * 席位映射表。
 *
 * slot 名与注册元数据属于 **DSH 版本契约**（rc.1 → rc.4 已在连发），所以集中
 * 在这一张表里：宿主升级时只改这里，`verify.mjs` 的断言也按这张表核对。
 *
 * 0.2.0 的席位变化（用户意见）：
 * - **删掉左侧栏导航行席位**：左侧栏不再单独占一行菜单；
 * - **新增** `settings.section`：入口收进「设置」里的一张分区卡片；
 * - `main`（中央整页月历）**保留**；
 * - `shell.overlay` 从「右下角小浮标」换成「左下角常驻月历」。
 *
 * - {@link SEATS.main}：中央主区，keyed 席位，root 作用域（拿不到会话数据，日历也不需要）
 * - {@link SEATS.settings}：设置页分区，list 席位，`order` 排在最后
 * - {@link SEATS.overlay}：框架级浮层，list 席位，本身点击穿透（卡片自己开 pointer-events）
 */

/** 主面板 id：中央 `main` 的 key，也是 `ctx.layout.selectPanel()` 的选择子。 */
export const PANEL_ID = 'huaxia-calendar'

/** bundle id 必须与包名一致（spike 已验证的约定）。 */
export const PLUGIN_NAME = 'huaxia-calendar-dsh'

/**
 * 设置分区在导航里的顺序：排在其他分区之后（其余分区用负数或 0/10 这类小值）。
 * 放最后符合用户「塞在设置里就行」的预期，不抢已有分区的位置。
 */
const SETTINGS_ORDER = 1000

export const SEATS = {
  main: {
    name: 'main',
    key: PANEL_ID,
  },
  settings: {
    name: 'settings.section',
    id: PANEL_ID,
    order: SETTINGS_ORDER,
    label: '华夏日历',
  },
  overlay: {
    name: 'shell.overlay',
    id: `${PANEL_ID}.mini`,
  },
} as const

/**
 * 本插件占用的席位清单（给 `verify.mjs` 与诊断用）。
 *
 * 刻意**不含左侧栏导航行**：0.2.0 起左栏不再有「华夏日历」行。
 */
export const REGISTERED_SEATS = [
  SEATS.main.name,
  SEATS.settings.name,
  SEATS.overlay.name,
] as const
