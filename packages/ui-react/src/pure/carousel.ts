/**
 * 历史叙事轮播的纯逻辑：索引回绕、`1 / 3` 计数文案、8 秒自动播放的状态机。
 *
 * 不依赖 React、DOM 与宿主 API，可用 `node --test` 直接覆盖：
 * - 条目列表的越界回绕（`‹`/`›`、圆点跳转、自动切到下一条）；
 * - 只有 0 / 1 / N 条时都成立（内容包按天增删条目不改变组件行为）；
 * - 手动切换 / 换日期 / 暂停后恢复都**重置自动播放计时**（`timerKey` 自增），
 *   组件只需要监听 `timerKey` 重新挂 `setTimeout`；
 * - 悬停 / 键盘聚焦暂停（`paused`），离开恢复。
 *
 * 状态机的「计时」不真的持有定时器：`timerKey` 是计时版本号，变化的次数就是
 * 「重新计时」的次数。真正的 `setTimeout` 在组件里，卸载时由 `useEffect` 清理。
 */

/** 自动轮播间隔（毫秒）：8 秒一条。 */
export const CAROUSEL_INTERVAL_MS = 8000

/**
 * 把任意索引回绕到 `[0, total)` 区间。
 *
 * - `total <= 0`（当天没有条目）时恒为 0；
 * - 负数与超界都走环回：`-1 → total-1`、`total → 0`；
 * - 非整数索引向下取整，不抛错（数据/事件源不可信时 UI 不能崩）。
 */
export function wrapCarouselIndex(index: number, total: number): number {
  if (!Number.isInteger(total) || total <= 0) return 0
  if (!Number.isFinite(index)) return 0
  const truncated = Math.trunc(index)
  return ((truncated % total) + total) % total
}

/**
 * 相对当前索引前进 / 后退若干条（越界回绕）。
 *
 * @param index - 当前索引（可越界，先回绕）。
 * @param delta - 位移条数，必须是整数；`1` 下一条、`-1` 上一条。
 * @param total - 当天条目总数。
 */
export function stepCarouselIndex(index: number, delta: number, total: number): number {
  if (!Number.isInteger(delta)) {
    throw new RangeError(`[shishu/ui-react] 轮播位移必须是整数，收到 ${String(delta)}`)
  }
  if (!Number.isInteger(total) || total <= 0) return 0
  return wrapCarouselIndex(wrapCarouselIndex(index, total) + delta, total)
}

/**
 * 轮播计数文案：`1 / 3`、`2 / 3`…
 *
 * 0 条时返回空串（控件整体隐藏，不显示 `0 / 0` 这种噪音）；1 条时返回
 * `1 / 1` 但调用方会连同切换控件一起隐藏。
 */
export function carouselCountText(index: number, total: number): string {
  if (!Number.isInteger(total) || total <= 0) return ''
  return `${wrapCarouselIndex(index, total) + 1} / ${total}`
}

/** 历史叙事轮播状态。 */
export interface CarouselState {
  /** 当前选中日期的稳定键（`YYYY-M-D`）；日期一变就回到第 1 条。 */
  dateKey: string
  /** 当前条目索引（可能越界，渲染前用 {@link wrapCarouselIndex} 收敛）。 */
  index: number
  /** 是否暂停自动轮播（鼠标悬停 / 键盘聚焦时为 true）。 */
  paused: boolean
  /**
   * 计时版本号：每次「需要重新计满 8 秒」的动作都 +1。
   *
   * 手动切换、圆点跳转、换日期、自动切换成功、暂停后恢复都会让它自增；
   * 组件把它放进 `useEffect` 依赖里，就等于「重置计时」。
   */
  timerKey: number
}

/** 轮播动作。 */
export type CarouselAction =
  | { type: 'select-date'; dateKey: string }
  | { type: 'next'; total: number }
  | { type: 'prev'; total: number }
  | { type: 'jump'; index: number; total: number }
  /** 自动播放推进一条；暂停或不足 2 条时忽略。 */
  | { type: 'auto'; total: number }
  | { type: 'pause' }
  | { type: 'resume' }

/** 初始状态：第 1 条、不暂停、计时版本号 0。 */
export function initialCarouselState(dateKey: string): CarouselState {
  return { dateKey, index: 0, paused: false, timerKey: 0 }
}

/**
 * 轮播状态机（纯函数）。
 *
 * 所有返回新对象的动作都保证不原地修改传入的 state；无实际变化时**原样返回**
 * 旧对象，React 可以据此跳过重渲染。
 */
export function carouselReducer(state: CarouselState, action: CarouselAction): CarouselState {
  switch (action.type) {
    case 'select-date': {
      if (action.dateKey === state.dateKey) return state
      // 换日期：回到第 1 条并重置计时；暂停状态保持（鼠标可能还停在卡片上）。
      return { ...state, dateKey: action.dateKey, index: 0, timerKey: state.timerKey + 1 }
    }
    case 'next': {
      const index = stepCarouselIndex(state.index, 1, action.total)
      return { ...state, index, timerKey: state.timerKey + 1 }
    }
    case 'prev': {
      const index = stepCarouselIndex(state.index, -1, action.total)
      return { ...state, index, timerKey: state.timerKey + 1 }
    }
    case 'jump': {
      const index = wrapCarouselIndex(action.index, action.total)
      return { ...state, index, timerKey: state.timerKey + 1 }
    }
    case 'auto': {
      if (state.paused) return state
      if (!Number.isInteger(action.total) || action.total <= 1) return state
      const index = stepCarouselIndex(state.index, 1, action.total)
      return { ...state, index, timerKey: state.timerKey + 1 }
    }
    case 'pause': {
      if (state.paused) return state
      return { ...state, paused: true }
    }
    case 'resume': {
      if (!state.paused) return state
      // 恢复时重新计满 8 秒，而不是立刻切走。
      return { ...state, paused: false, timerKey: state.timerKey + 1 }
    }
    default: {
      // 穷举保护：新增动作忘记处理时类型检查会报错，运行时则原样返回。
      return state
    }
  }
}
