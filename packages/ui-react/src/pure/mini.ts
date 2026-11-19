/**
 * 左下角月历的纯逻辑：位置几何（默认左下 / 拖拽钳制）、年月翻页、
 * localStorage 偏好的解析与序列化。
 *
 * 全部不依赖 React、DOM 与宿主 API，可直接用 `node --test` 覆盖：
 * 拖拽边界钳制、跨年翻月、收起/展开状态、位置持久化都在这里被守住。
 */
import { shiftMonth } from './calendar.ts'

/** 尺寸（px）。 */
export interface Size {
  width: number
  height: number
}

/** 视口坐标系里的点（左上角原点）。 */
export interface Point {
  x: number
  y: number
}

/** 视口里的矩形：`x/y` 为左上角，`width/height` 为尺寸。 */
export interface Rect extends Point, Size {}

/** 年月视图。 */
export interface YearMonth {
  year: number
  month: number
}

/** 卡片与视口边缘的最小留白（px）。 */
export const OVERLAY_MARGIN = 12

/** 默认位置：左下角。`y = 视口高 - 卡片高 - 留白`。 */
export function defaultOverlayRect(size: Size, viewport: Size, margin: number = OVERLAY_MARGIN): Point {
  return {
    x: margin,
    y: Math.max(margin, viewport.height - size.height - margin),
  }
}

/**
 * 把矩形左上角钳制进视口。
 *
 * 视口比卡片还小时（窄窗口 / 展开后卡片偏高），`max` 会小于 `margin`；此时仍然
 * 返回 `margin`，宁可让卡片右侧/下侧溢出，也保证标题栏（拖动把手）落在视口里可抓。
 */
export function clampOverlayRect(rect: Rect, viewport: Size, margin: number = OVERLAY_MARGIN): Point {
  const maxX = viewport.width - rect.width - margin
  const maxY = viewport.height - rect.height - margin
  return {
    x: Math.max(margin, Math.min(rect.x, maxX)),
    y: Math.max(margin, Math.min(rect.y, maxY)),
  }
}

/** 拖拽结果：起点 + 指针位移，再钳制进视口。 */
export function dragOverlayRect(
  start: Rect,
  delta: Point,
  viewport: Size,
  margin: number = OVERLAY_MARGIN,
): Point {
  return clampOverlayRect(
    { width: start.width, height: start.height, x: start.x + delta.x, y: start.y + delta.y },
    viewport,
    margin,
  )
}

/**
 * 年月视图平移（`deltaMonths` 可跨年，`±12` 即整年翻页）。
 *
 * @param view - 当前年月（月为 1-12）。
 * @param deltaMonths - 平移的月数；必须是整数。
 * @returns 平移后的年月，跨年自动进位/借位。
 */
export function shiftYearMonth(view: YearMonth, deltaMonths: number): YearMonth {
  if (!Number.isInteger(deltaMonths)) {
    throw new RangeError(`[shishu/ui-react] 翻页月数必须是整数，收到 ${String(deltaMonths)}`)
  }
  return shiftMonth(view.year, view.month, deltaMonths)
}

/** 左下角月历的持久化偏好。 */
export interface MiniPrefs {
  /**
   * 用户拖拽后的左上角（视口坐标）；`null` 表示仍用默认左下角，
   * 即随窗口尺寸自适应，不记死坐标。
   */
  position: Point | null
  /** 是否收起为一条小条。 */
  collapsed: boolean
  /** 是否在角落显示（设置页的开关，也控制整张卡片的显隐）。 */
  visible: boolean
}

/** localStorage 键名：带版本后缀，未来格式变化时不误读旧数据。 */
export const MINI_PREFS_KEY = 'huaxia-calendar.mini.v1'

/** 默认偏好：左下角展开、显示。 */
export const MINI_PREFS_DEFAULT: Readonly<MiniPrefs> = Object.freeze({
  position: null,
  collapsed: false,
  visible: true,
})

function isFinitePoint(value: unknown): value is Point {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate['x'] === 'number' &&
    Number.isFinite(candidate['x']) &&
    typeof candidate['y'] === 'number' &&
    Number.isFinite(candidate['y'])
  )
}

/**
 * 解析 localStorage 里的原始字符串。
 *
 * 任何脏数据（缺键、坏 JSON、类型不对）都退回默认值，绝不抛错 —— 这是角落里
 * 的一个装饰性卡片，不该因为一条坏记录把整个宿主面板打崩。
 */
export function parseMiniPrefs(raw: string | null | undefined): MiniPrefs {
  const fallback: MiniPrefs = {
    position: MINI_PREFS_DEFAULT.position,
    collapsed: MINI_PREFS_DEFAULT.collapsed,
    visible: MINI_PREFS_DEFAULT.visible,
  }
  if (typeof raw !== 'string' || raw.length === 0) return fallback
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return fallback
  }
  if (typeof parsed !== 'object' || parsed === null) return fallback
  const record = parsed as Record<string, unknown>
  return {
    position: isFinitePoint(record['position']) ? { x: record['position'].x, y: record['position'].y } : null,
    collapsed: record['collapsed'] === true,
    visible: record['visible'] !== false,
  }
}

/** 序列化偏好（只写有意义的字段）。 */
export function serializeMiniPrefs(prefs: MiniPrefs): string {
  const payload: Record<string, unknown> = {
    collapsed: prefs.collapsed === true,
    visible: prefs.visible !== false,
  }
  if (prefs.position !== null) payload['position'] = { x: prefs.position.x, y: prefs.position.y }
  return JSON.stringify(payload)
}

function samePoint(a: Point | null, b: Point | null): boolean {
  if (a === null || b === null) return a === b
  return a.x === b.x && a.y === b.y
}

function sameMiniPrefs(a: MiniPrefs, b: MiniPrefs): boolean {
  return a.collapsed === b.collapsed && a.visible === b.visible && samePoint(a.position, b.position)
}

/**
 * 打补丁：只替换传入的字段。
 *
 * 没有实际变化时**原样返回旧对象**，这样 store 可以据此跳过持久化与通知，
 * 避免拖拽时每帧都写一次 localStorage。
 */
export function patchMiniPrefs(prefs: MiniPrefs, patch: Partial<MiniPrefs>): MiniPrefs {
  const next: MiniPrefs = {
    position: patch.position === undefined ? prefs.position : patch.position,
    collapsed: patch.collapsed === undefined ? prefs.collapsed : patch.collapsed === true,
    visible: patch.visible === undefined ? prefs.visible : patch.visible === true,
  }
  return sameMiniPrefs(prefs, next) ? prefs : next
}

/** 收起 ⟷ 展开。 */
export function toggleMiniCollapsed(prefs: MiniPrefs): MiniPrefs {
  return patchMiniPrefs(prefs, { collapsed: !prefs.collapsed })
}

/** 显示 ⟷ 隐藏（设置页开关）。 */
export function toggleMiniVisible(prefs: MiniPrefs): MiniPrefs {
  return patchMiniPrefs(prefs, { visible: !prefs.visible })
}
