/**
 * `<MiniCalendar />` —— 左下角常驻的紧凑月历（0.2.0 的核心新功能，取代原右下角浮标）。
 *
 * 宿主把本组件挂在 `shell.overlay`（页面级浮层，本身「点击穿透」）。所以卡片根节点
 * 自己打开 `pointer-events: auto`；浮层不是操作系统窗口，拖拽只能在浏览器视口内，
 * 位置会被钳制到视口里并写进 localStorage，刷新后保持。
 *
 * 能力：
 * - 显示当月每一天（公历日 + 农历日/节气），星期表头 + 7 列网格；
 * - 切换年 / 月，另有「今天」；
 * - 点击某天 → 该日高亮，卡片底部一行显示该日农历 + 干支 + 节气/节日/叙事标题；
 * - 拖动标题栏到任意位置（视口内钳制）；
 * - 收起 / 展开（收起态是一条小条，显示今天农历日 + 今日节气）；
 * - 「打开完整日历」按钮 —— 动作由宿主通过 props 回调传入（ui-react 不 import 任何 `@deepseek-ai/*`）。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactElement } from 'react'
import {
  buildDayBrief,
  buildMonthGrid,
  isSameDate,
  toDateKey,
  todayDate,
  type CalendarDate,
  type CalendarDay,
} from './pure/calendar.ts'
import { WEEKDAY_SHORT, formatCellCaption, formatMiniDayLine, formatPill } from './pure/format.ts'
import {
  OVERLAY_MARGIN,
  clampOverlayRect,
  dragOverlayRect,
  shiftYearMonth,
  type Point,
  type Size,
  type YearMonth,
} from './pure/mini.ts'
import type { MiniCalendarStore } from './miniStore.ts'
import { useMiniCalendarPrefs } from './miniStore.ts'
import { RADIUS, TOKENS, fontSize, type CalendarStyle } from './theme.ts'

/** 视口尺寸（无 `window` 时给一个保守的默认，便于离线渲染）。 */
function viewportSize(): Size {
  if (typeof window === 'undefined') return { width: 1440, height: 900 }
  return {
    width: window.innerWidth > 0 ? window.innerWidth : 1440,
    height: window.innerHeight > 0 ? window.innerHeight : 900,
  }
}

/** 卡片默认尺寸估计（还没测量时的钳制兜底）。 */
const FALLBACK_SIZE: Size = { width: 264, height: 332 }

/** 指针移动超过这个距离才算拖拽，否则视为点击。 */
const DRAG_THRESHOLD = 3

/** 展开态卡片宽度。 */
const EXPANDED_WIDTH = 264

/** 收起态卡片宽度。 */
const COLLAPSED_WIDTH = 224

interface DragState {
  pointerId: number
  /** 指针按下处的视口坐标。 */
  origin: Point
  /** 按下瞬间卡片的左上角（由 getBoundingClientRect 换算）。 */
  start: Point
  /** 按下瞬间的卡片尺寸。 */
  size: Size
  moved: boolean
}

const buttonStyle: CalendarStyle = {
  appearance: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '0 0 auto',
  width: 20,
  height: 20,
  padding: 0,
  border: 'none',
  borderRadius: RADIUS.xs,
  background: 'transparent',
  color: TOKENS.labelTertiary,
  fontFamily: TOKENS.fontText,
  fontSize: fontSize(-3),
  lineHeight: 1,
  cursor: 'pointer',
}

const baseCellStyle: CalendarStyle = {
  appearance: 'none',
  position: 'relative',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 1,
  height: 30,
  padding: '1px 0 2px',
  border: '1px solid transparent',
  borderRadius: RADIUS.xs,
  background: 'transparent',
  color: TOKENS.labelPrimary,
  fontFamily: TOKENS.fontText,
  cursor: 'pointer',
  outline: 'none',
  transition: 'background 100ms ease, border-color 100ms ease',
}

function miniCellStyle(day: CalendarDay, selected: boolean, hovered: boolean): CalendarStyle {
  if (day.isToday) {
    return { ...baseCellStyle, border: `1px solid ${TOKENS.brandPrimary}`, background: TOKENS.interactiveHover }
  }
  if (selected) {
    return { ...baseCellStyle, border: `1px solid ${TOKENS.brandPrimary}` }
  }
  if (hovered) return { ...baseCellStyle, background: TOKENS.interactiveHover }
  return baseCellStyle
}

function miniDayNumberStyle(day: CalendarDay): CalendarStyle {
  const base: CalendarStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 18,
    height: 18,
    borderRadius: '50%',
    fontSize: fontSize(-3),
    fontWeight: 500,
    lineHeight: 1,
    color: day.isWeekend ? TOKENS.labelSecondary : TOKENS.labelPrimary,
  }
  if (day.isToday) {
    return {
      ...base,
      background: TOKENS.brandPrimary,
      color: TOKENS.labelPrimaryForeground,
      fontWeight: 600,
    }
  }
  return base
}

function miniCaptionStyle(day: CalendarDay): CalendarStyle {
  const base: CalendarStyle = {
    fontSize: fontSize(-5),
    lineHeight: 1.1,
    letterSpacing: 0,
    color: TOKENS.labelTertiary,
    whiteSpace: 'nowrap',
  }
  if (day.solarTerm !== undefined) return { ...base, color: TOKENS.brandPrimary, fontWeight: 500 }
  if (day.lunar.lunarDay === 1) return { ...base, color: TOKENS.labelSecondary }
  return base
}

/**
 * 默认锚点：卡片没被拖动过时贴哪。
 *
 * 默认是视口左下角（12px 留白）；宿主可以传入自己的「左下角」——例如主内容区
 * 的左下角——避免压住宿主左侧栏底部的账号/设置入口。用户一旦拖过卡片，
 * 持久化的坐标优先，锚点不再生效。
 */
export interface MiniCalendarAnchor {
  /** 距锚点左边的像素。 */
  left?: number
  /** 距锚点底边的像素。 */
  bottom?: number
}

/** 左下角月历的 props。 */
export interface MiniCalendarProps {
  /** 共享偏好 store（与设置卡片共用同一份状态）。 */
  store: MiniCalendarStore
  /** 打开宿主中央的完整月历面板；由宿主注入（如 `ctx.layout.selectPanel(...)`）。 */
  onOpenFullCalendar?: () => void
  /** 未拖拽时的默认锚点（默认视口左下角 12px 留白）。 */
  defaultAnchor?: MiniCalendarAnchor
}

/** 左下角常驻月历。 */
export function MiniCalendar(props: MiniCalendarProps): ReactElement | null {
  const { store, onOpenFullCalendar, defaultAnchor } = props
  const prefs = useMiniCalendarPrefs(store)

  const [today, setToday] = useState<CalendarDate>(() => todayDate())
  const [view, setView] = useState<YearMonth>(() => {
    const now = todayDate()
    return { year: now.year, month: now.month }
  })
  const [selected, setSelected] = useState<CalendarDate>(() => todayDate())
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const [hoveredNav, setHoveredNav] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const cardRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<DragState | null>(null)

  const collapsed = prefs.collapsed

  // 跨零点自动换到新的一天（收起态的小条也要准）。
  useEffect(() => {
    const timer = setInterval(() => {
      const now = todayDate()
      setToday((prev) => (isSameDate(prev, now) ? prev : now))
    }, 30_000)
    return () => clearInterval(timer)
  }, [])

  // 恢复的旧位置可能落在视口外（窗口变小了）：挂载与 resize 时重新钳制。
  useEffect(() => {
    const clampIntoViewport = (): void => {
      const current = store.get().position
      if (current === null) return
      const rect = cardRef.current?.getBoundingClientRect()
      const size: Size =
        rect === undefined ? FALLBACK_SIZE : { width: rect.width, height: rect.height }
      const next = clampOverlayRect(
        { x: current.x, y: current.y, width: size.width, height: size.height },
        viewportSize(),
      )
      if (next.x !== current.x || next.y !== current.y) store.set({ position: next })
    }
    clampIntoViewport()
    if (typeof window === 'undefined') return undefined
    window.addEventListener('resize', clampIntoViewport)
    return () => window.removeEventListener('resize', clampIntoViewport)
  }, [store, prefs.position, collapsed])

  const grid = useMemo(() => buildMonthGrid(view.year, view.month, { today }), [view, today])
  const selectedBrief = useMemo(() => buildDayBrief(selected), [selected])
  const todayBrief = useMemo(() => buildDayBrief(today), [today])

  const stepMonths = useCallback((delta: number) => {
    setView((prev) => shiftYearMonth(prev, delta))
  }, [])

  const stepYears = useCallback((delta: number) => {
    setView((prev) => shiftYearMonth(prev, delta * 12))
  }, [])

  const goToday = useCallback(() => {
    const now = todayDate()
    setToday(now)
    setView({ year: now.year, month: now.month })
    setSelected(now)
  }, [])

  const selectDay = useCallback((day: CalendarDay) => {
    setSelected(day.date)
    if (!day.inMonth) setView({ year: day.date.year, month: day.date.month })
  }, [])

  const toggleCollapsed = useCallback(() => {
    store.set({ collapsed: !store.get().collapsed })
  }, [store])

  // ── 拖拽：按住标题栏移动，位置钳制进视口并持久化 ──────────────────────────
  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const target = event.target
    // 标题栏里的按钮不参与拖拽，否则点按钮会变成拖动。
    if (target instanceof HTMLElement && target.closest('button') !== null) return
    const rect = cardRef.current?.getBoundingClientRect()
    dragRef.current = {
      pointerId: event.pointerId,
      origin: { x: event.clientX, y: event.clientY },
      start: rect === undefined ? { x: OVERLAY_MARGIN, y: OVERLAY_MARGIN } : { x: rect.left, y: rect.top },
      size: rect === undefined ? FALLBACK_SIZE : { width: rect.width, height: rect.height },
      moved: false,
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // 某些合成事件没有 capture 能力，忽略即可。
    }
    setDragging(true)
  }, [])

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const state = dragRef.current
      if (state === null || state.pointerId !== event.pointerId) return
      const delta = { x: event.clientX - state.origin.x, y: event.clientY - state.origin.y }
      if (!state.moved && Math.abs(delta.x) < DRAG_THRESHOLD && Math.abs(delta.y) < DRAG_THRESHOLD) {
        return
      }
      state.moved = true
      // 每帧都写 store：卡片实时跟手；store 自己会做「无变化不落盘」。
      store.set({
        position: dragOverlayRect(
          { x: state.start.x, y: state.start.y, width: state.size.width, height: state.size.height },
          delta,
          viewportSize(),
        ),
      })
    },
    [store],
  )

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const state = dragRef.current
    if (state === null || state.pointerId !== event.pointerId) return
    dragRef.current = null
    setDragging(false)
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // 同上：没有 capture 时忽略。
    }
  }, [])

  // 隐藏状态：整张卡片不渲染（设置页的开关可以重新打开）。
  if (!prefs.visible) return null

  const anchor: CalendarStyle =
    prefs.position === null
      ? {
          left: defaultAnchor?.left ?? OVERLAY_MARGIN,
          bottom: defaultAnchor?.bottom ?? OVERLAY_MARGIN,
        }
      : { left: prefs.position.x, top: prefs.position.y }

  const rootStyle: CalendarStyle = {
    ...anchor,
    position: 'fixed',
    zIndex: 60,
    boxSizing: 'border-box',
    width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: collapsed ? '4px 5px' : '6px 7px 7px',
    border: `1px solid ${TOKENS.borderL1}`,
    borderRadius: RADIUS.md,
    background: TOKENS.bgLayer1,
    boxShadow: TOKENS.elevationPanel,
    color: TOKENS.labelPrimary,
    fontFamily: TOKENS.fontText,
    fontSize: TOKENS.contentFontSize,
    // `shell.overlay` 本身点击穿透，卡片必须显式接回指针事件。
    pointerEvents: 'auto',
    userSelect: 'none',
  }

  const handleStyle: CalendarStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    minHeight: 22,
    padding: '1px 1px 1px 2px',
    borderRadius: RADIUS.xs,
    cursor: dragging ? 'grabbing' : 'grab',
    touchAction: 'none',
  }

  const navButton = (key: string, label: string, ariaLabel: string, onClick: () => void) => (
    <button
      key={key}
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={onClick}
      onMouseEnter={() => setHoveredNav(key)}
      onMouseLeave={() => setHoveredNav(null)}
      style={{
        ...buttonStyle,
        color: hoveredNav === key ? TOKENS.labelPrimary : TOKENS.labelTertiary,
        background: hoveredNav === key ? TOKENS.interactiveHover : 'transparent',
      }}
    >
      {label}
    </button>
  )

  const iconButton = (key: string, glyph: string, label: string, onClick: () => void) => (
    <button
      key={key}
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      style={buttonStyle}
    >
      {glyph}
    </button>
  )

  const pill = formatPill(todayBrief)
  const selectedLine = formatMiniDayLine(selectedBrief, { isToday: isSameDate(selected, today) })

  return (
    <div
      ref={cardRef}
      data-huaxia-mini-calendar=""
      data-huaxia-mini-state={collapsed ? 'collapsed' : 'expanded'}
      {...(collapsed ? { 'data-huaxia-mini-collapsed': '' } : null)}
      role="region"
      aria-label="华夏日历 月历"
      style={rootStyle}
    >
      {/* 标题栏 = 拖拽把手；收起态这一行就是全部内容。 */}
      <div
        data-huaxia-mini-handle=""
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={handleStyle}
      >
        <span
          aria-hidden="true"
          style={{
            flex: '0 0 auto',
            width: 5,
            height: 14,
            borderRadius: 3,
            background: TOKENS.brandPrimary,
          }}
        />
        {collapsed ? (
          <>
            <span
              style={{
                fontSize: fontSize(-1.5),
                fontWeight: 600,
                letterSpacing: 0.3,
                color: TOKENS.labelPrimary,
                whiteSpace: 'nowrap',
              }}
            >
              {pill.primary}
            </span>
            <span
              style={{
                fontSize: fontSize(-3.5),
                color: TOKENS.labelTertiary,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {pill.secondary}
            </span>
          </>
        ) : (
          <span
            style={{
              fontSize: fontSize(-3.5),
              letterSpacing: 0.5,
              color: TOKENS.labelTertiary,
              whiteSpace: 'nowrap',
            }}
          >
            华夏日历
          </span>
        )}
        <span style={{ flex: '1 1 auto' }} />
        {collapsed ? null : iconButton('today', '今', '回到今天', goToday)}
        {iconButton('open', '⤢', '打开完整日历', () => onOpenFullCalendar?.())}
        {collapsed
          ? iconButton('expand', '⌃', '展开月历', toggleCollapsed)
          : iconButton('collapse', '⌄', '收起月历', toggleCollapsed)}
        {iconButton('hide', '×', '隐藏月历（可在设置里重新打开）', () => store.set({ visible: false }))}
      </div>

      {collapsed ? null : (
        <>
          {/* 年月导航：‹‹ 上一年 · ‹ 上个月 · 当前年月 · 下个月 › · 下一年 ›› */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              padding: '1px 0 2px',
              borderTop: `1px solid ${TOKENS.borderL1}`,
            }}
          >
            {navButton('prev-year', '‹‹', '上一年', () => stepYears(-1))}
            {navButton('prev-month', '‹', '上一个月', () => stepMonths(-1))}
            <span
              data-huaxia-mini-title=""
              style={{
                flex: '1 1 auto',
                textAlign: 'center',
                fontSize: fontSize(-1.5),
                fontWeight: 600,
                letterSpacing: 0.3,
                color: TOKENS.labelPrimary,
                whiteSpace: 'nowrap',
              }}
            >
              {`${view.year}年${view.month}月`}
            </span>
            {navButton('next-month', '›', '下一个月', () => stepMonths(1))}
            {navButton('next-year', '››', '下一年', () => stepYears(1))}
          </div>

          {/* 星期表头：周首周日，与 core 的 weekday 对齐 */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
              gap: 1,
              padding: '0 0 2px',
            }}
          >
            {WEEKDAY_SHORT.map((label, weekday) => (
              <span
                key={label}
                style={{
                  textAlign: 'center',
                  fontSize: fontSize(-4.5),
                  lineHeight: '14px',
                  color:
                    weekday === 0 || weekday === 6 ? TOKENS.labelTertiary : TOKENS.labelSecondary,
                  fontFamily: TOKENS.fontText,
                }}
              >
                {label}
              </span>
            ))}
          </div>

          {/* 当月每一天：公历日 + 农历日/节气 */}
          <div
            data-huaxia-mini-grid=""
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
              gap: 1,
            }}
          >
            {grid.days.map((day) => {
              const key = toDateKey(day.date)
              const selectedDay = isSameDate(day.date, selected)
              return (
                <button
                  key={key}
                  type="button"
                  data-huaxia-mini-day=""
                  data-date={key}
                  data-lunar={day.lunar.lunarDayName}
                  aria-label={`${day.date.month}月${day.date.day}日 ${day.lunar.lunarMonthName}${day.lunar.lunarDayName}${
                    day.solarTerm !== undefined ? ` ${day.solarTerm}` : ''
                  }${day.isToday ? ' 今天' : ''}`}
                  aria-current={day.isToday ? 'date' : undefined}
                  onClick={() => selectDay(day)}
                  onMouseEnter={() => setHoveredKey(key)}
                  onMouseLeave={() => setHoveredKey(null)}
                  style={{
                    ...miniCellStyle(day, selectedDay, hoveredKey === key),
                    ...(day.inMonth ? null : { opacity: 0.38 }),
                  }}
                >
                  <span style={miniDayNumberStyle(day)}>{day.date.day}</span>
                  <span style={miniCaptionStyle(day)}>{formatCellCaption(day)}</span>
                </button>
              )
            })}
          </div>

          {/* 选中日一行信息：农历 + 干支 + 节气 / 节日 / 叙事标题 */}
          <div
            data-huaxia-mini-detail=""
            title={selectedLine}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              minHeight: 20,
              padding: '2px 3px 0',
              borderTop: `1px solid ${TOKENS.borderL1}`,
              fontSize: fontSize(-3.5),
              lineHeight: 1.4,
              color: TOKENS.labelSecondary,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                flex: '0 0 auto',
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: isSameDate(selected, today) ? TOKENS.brandPrimary : TOKENS.labelCaption,
              }}
            />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedLine}</span>
          </div>
        </>
      )}
    </div>
  )
}
