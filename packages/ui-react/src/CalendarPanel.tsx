/**
 * `<CalendarPanel />` —— 主面板整页月历 + 当日一屏。
 *
 * 宿主无关：只用 React 18 + 内联样式 + 宿主主题 CSS 变量，读不到也不依赖任何
 * DSH API，所以同一个组件可以直接搬进 VS Code webview。
 *
 * 0.2.0：配色全部改为宿主 DSH 主题 token（见 `./theme.ts`），不再自带任何品牌色，
 * light / dark 模式下自动跟随宿主。
 *
 * 0.3.0：「今日一屏」的历史叙事从单条改成**轮播**——当天多条（中华文明优先、
 * 兼及世界），`‹ ›` / 计数 / 圆点可切换，8 秒自动播放（悬停或键盘聚焦暂停），
 * 容器可聚焦并支持 `←` / `→`，条数 0 / 1 / N 都有正确降级。
 *
 * 卡片按 `dateKind` 明确标注日期口径：`exact` =「历史上的今天」（确实发生在当天），
 * `period` =「华夏文明坐标 · origin · yearLabel」（只按年份/朝代入档，**不是**当天发生）。
 * 缺省字段按 `period` 降级，绝不把文明坐标谎称成今天。区块标题也据此变成
 * 「今日 · 古今中外」/「华夏文明坐标 · 古今中外」，不再笼统叫「历史叙事」。
 *
 * 数据全部来自 `@shishu/core`（农历/节气/干支/节日本地实算）与
 * `@shishu/content-l1`（每天多条历史叙事，按天轮播）。
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type {
  FocusEvent as ReactFocusEvent,
  KeyboardEvent as ReactKeyboardEvent,
  ReactElement,
} from 'react'
import { packManifest } from '@shishu/content-l1'
import {
  buildDayBrief,
  buildMonthGrid,
  buildMonthHeader,
  isSameDate,
  shiftMonth,
  toDateKey,
  todayDate,
  type CalendarDate,
  type CalendarDay,
} from './pure/calendar.ts'
import {
  CAROUSEL_INTERVAL_MS,
  carouselCountText,
  carouselReducer,
  initialCarouselState,
  wrapCarouselIndex,
} from './pure/carousel.ts'
import {
  WEEKDAY_SHORT,
  carouselSectionTitle,
  eventDateKind,
  formatCellCaption,
  formatEventAttribution,
  formatEventCategory,
  formatEventDateKindDetail,
  formatEventHeadline,
  formatEventOrigin,
  formatFestivalLabel,
  formatGanZhiLine,
  formatSolarDate,
  formatSolarTermLine,
  eventRegion,
} from './pure/format.ts'
import { RADIUS, TOKENS, fontSize, type CalendarStyle } from './theme.ts'

/** 月历格子的固定行高（px）；行数 4–6 由网格自适应。 */
const CELL_HEIGHT = 52

const rootStyle: CalendarStyle = {
  boxSizing: 'border-box',
  width: '100%',
  minHeight: '100%',
  padding: '22px 26px 20px',
  background: TOKENS.bgBase,
  color: TOKENS.labelPrimary,
  fontFamily: TOKENS.fontText,
  fontSize: TOKENS.contentFontSize,
  overflow: 'auto',
}

const frameStyle: CalendarStyle = {
  boxSizing: 'border-box',
  maxWidth: 1080,
  margin: '0 auto',
}

const headerStyle: CalendarStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 16,
  flexWrap: 'wrap',
  paddingBottom: 14,
  borderBottom: `1px solid ${TOKENS.borderL2}`,
}

const sealStyle: CalendarStyle = {
  width: 30,
  height: 30,
  flex: '0 0 auto',
  borderRadius: RADIUS.sm,
  border: `1px solid ${TOKENS.borderL2}`,
  background: TOKENS.interactiveHover,
  color: TOKENS.brandPrimary,
  fontFamily: TOKENS.fontText,
  fontSize: fontSize(4),
  fontWeight: 600,
  lineHeight: '28px',
  textAlign: 'center',
  letterSpacing: 0,
  userSelect: 'none',
}

const titleStyle: CalendarStyle = {
  margin: 0,
  fontSize: fontSize(8),
  fontWeight: 600,
  letterSpacing: 1.5,
  lineHeight: 1.25,
  color: TOKENS.labelPrimary,
}

const subtitleStyle: CalendarStyle = {
  margin: '5px 0 0',
  fontSize: fontSize(-2),
  letterSpacing: 0.5,
  color: TOKENS.labelTertiary,
  fontFamily: TOKENS.fontText,
}

const navGroupStyle: CalendarStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  paddingTop: 2,
}

const navButtonBase: CalendarStyle = {
  appearance: 'none',
  border: `1px solid ${TOKENS.borderL2}`,
  borderRadius: RADIUS.sm,
  background: TOKENS.bgLayer1,
  color: TOKENS.labelSecondary,
  fontFamily: TOKENS.fontText,
  fontSize: fontSize(-2),
  lineHeight: 1,
  padding: '6px 10px',
  cursor: 'pointer',
}

const monthBarStyle: CalendarStyle = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 12,
  padding: '14px 0 8px',
  flexWrap: 'wrap',
}

const monthTitleStyle: CalendarStyle = {
  fontSize: fontSize(3),
  fontWeight: 600,
  letterSpacing: 0.5,
  color: TOKENS.labelPrimary,
}

const monthMetaStyle: CalendarStyle = {
  fontSize: fontSize(-3),
  letterSpacing: 0.5,
  color: TOKENS.labelTertiary,
  fontFamily: TOKENS.fontText,
}

const bodyStyle: CalendarStyle = {
  display: 'flex',
  alignItems: 'stretch',
  gap: 22,
  flexWrap: 'wrap',
  paddingTop: 4,
}

const calendarCardStyle: CalendarStyle = {
  flex: '1 1 520px',
  minWidth: 320,
}

const weekdayRowStyle: CalendarStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
  gap: 4,
  paddingBottom: 6,
  borderBottom: `1px solid ${TOKENS.borderL1}`,
}

const gridStyle: CalendarStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
  gap: 4,
  paddingTop: 6,
}

const hintRowStyle: CalendarStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  paddingTop: 10,
  fontSize: fontSize(-3),
  letterSpacing: 0.3,
  color: TOKENS.labelTertiary,
  fontFamily: TOKENS.fontText,
}

const briefCardStyle: CalendarStyle = {
  flex: '0 1 316px',
  minWidth: 272,
  boxSizing: 'border-box',
  padding: '14px 16px 16px',
  border: `1px solid ${TOKENS.borderL1}`,
  borderRadius: RADIUS.md,
  background: TOKENS.bgLayer2,
  boxShadow: TOKENS.elevationSoft,
}

const briefHeadStyle: CalendarStyle = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  paddingBottom: 8,
  borderBottom: `1px solid ${TOKENS.borderL1}`,
}

const briefTitleStyle: CalendarStyle = {
  fontSize: fontSize(-1),
  fontWeight: 600,
  letterSpacing: 1,
  color: TOKENS.labelPrimary,
}

const briefWeekdayStyle: CalendarStyle = {
  fontSize: fontSize(-3),
  letterSpacing: 0.5,
  color: TOKENS.labelTertiary,
  fontFamily: TOKENS.fontText,
}

const bigDateStyle: CalendarStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 0 6px',
}

const bigDayStyle: CalendarStyle = {
  fontSize: fontSize(26),
  fontWeight: 600,
  lineHeight: 1,
  letterSpacing: -1,
  color: TOKENS.labelPrimary,
}

const bigDayTodayStyle: CalendarStyle = {
  ...bigDayStyle,
  color: TOKENS.brandPrimary,
}

const bigDateMetaStyle: CalendarStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
  fontSize: fontSize(-2),
  color: TOKENS.labelSecondary,
  fontFamily: TOKENS.fontText,
}

const rowStyle: CalendarStyle = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 8,
  padding: '6px 0',
  borderBottom: `1px dashed ${TOKENS.borderL1}`,
}

const rowLabelStyle: CalendarStyle = {
  flex: '0 0 auto',
  width: 36,
  fontSize: fontSize(-3.5),
  letterSpacing: 1,
  color: TOKENS.labelTertiary,
  fontFamily: TOKENS.fontText,
}

const rowValueStyle: CalendarStyle = {
  flex: '1 1 auto',
  fontSize: fontSize(-1.5),
  lineHeight: 1.6,
  color: TOKENS.labelPrimary,
}

const eventBlockStyle: CalendarStyle = {
  marginTop: 12,
  padding: '11px 12px',
  border: `1px solid ${TOKENS.borderL1}`,
  borderRadius: RADIUS.sm,
  background: TOKENS.bgModule,
}

const eventLabelStyle: CalendarStyle = {
  fontSize: fontSize(-3.5),
  letterSpacing: 1,
  color: TOKENS.labelTertiary,
  fontFamily: TOKENS.fontText,
  marginBottom: 6,
}

const eventHeadlineStyle: CalendarStyle = {
  fontSize: fontSize(-1),
  fontWeight: 600,
  lineHeight: 1.55,
  color: TOKENS.labelPrimary,
}

const eventSummaryStyle: CalendarStyle = {
  margin: '7px 0 0',
  fontSize: fontSize(-2),
  lineHeight: 1.8,
  color: TOKENS.labelSecondary,
  textAlign: 'justify',
}

const eventAttributionStyle: CalendarStyle = {
  marginTop: 8,
  fontSize: fontSize(-3.5),
  letterSpacing: 0.3,
  color: TOKENS.labelCaption,
  fontFamily: TOKENS.fontText,
}

// ── 历史叙事轮播（0.3.0） ───────────────────────────────────────────────────

/** 标题行：区块标题 + 暂停提示 / 计数。 */
const carouselHeadStyle: CalendarStyle = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 8,
  marginBottom: 7,
}

/** 标签行：origin（中华 / 世界）+ category。 */
const carouselChipRowStyle: CalendarStyle = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 5,
  marginBottom: 6,
}

const carouselChipBase: CalendarStyle = {
  display: 'inline-block',
  padding: '1px 7px',
  borderRadius: 999,
  fontSize: fontSize(-3.5),
  lineHeight: 1.6,
  letterSpacing: 0.3,
  whiteSpace: 'nowrap',
}

/**
 * 文明归属标签：中华用实线 + 品牌色描边，世界用虚线 + 弱化文字色。
 * 只用宿主 token，深浅色自动跟随。
 */
function eventOriginChipStyle(region: 'china' | 'world'): CalendarStyle {
  if (region === 'world') {
    return {
      ...carouselChipBase,
      border: `1px dashed ${TOKENS.borderL2}`,
      background: 'transparent',
      color: TOKENS.labelTertiary,
    }
  }
  return {
    ...carouselChipBase,
    border: `1px solid ${TOKENS.borderL2}`,
    background: TOKENS.bgLayer3,
    color: TOKENS.brandPrimary,
    fontWeight: 500,
  }
}

const carouselCategoryChipStyle: CalendarStyle = {
  ...carouselChipBase,
  border: `1px solid ${TOKENS.borderL1}`,
  background: TOKENS.bgLayer1,
  color: TOKENS.labelTertiary,
}

/**
 * 日期口径标签（不能再含糊）：
 * - `exact`（确实发生在今天）：品牌色淡底 + 品牌色描边与文字；
 * - `period`（只以年份/朝代入档，不是当天发生）：透明底 + 边框色描边 + 弱化文字。
 *
 * 只用宿主 token（淡底用 `color-mix` 从 `--dsw-alias-brand-primary` 派生，不引入自有色值）。
 */
function eventKindChipStyle(kind: 'exact' | 'period'): CalendarStyle {
  if (kind === 'exact') {
    return {
      ...carouselChipBase,
      border: `1px solid ${TOKENS.brandPrimary}`,
      background: `color-mix(in srgb, ${TOKENS.brandPrimary} 14%, transparent)`,
      color: TOKENS.brandPrimary,
      fontWeight: 600,
    }
  }
  return {
    ...carouselChipBase,
    border: `1px solid ${TOKENS.borderL2}`,
    background: 'transparent',
    color: TOKENS.labelTertiary,
  }
}

/** 可聚焦的轮播舞台：键盘操作时给出宿主 token 的 focus 框。 */
function carouselStageStyle(focusVisible: boolean): CalendarStyle {
  return {
    borderRadius: RADIUS.xs,
    outline: focusVisible ? `2px solid ${TOKENS.brandPrimary}` : 'none',
    outlineOffset: 2,
  }
}

const carouselControlsStyle: CalendarStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginTop: 10,
  paddingTop: 8,
  borderTop: `1px dashed ${TOKENS.borderL1}`,
}

const carouselArrowStyle: CalendarStyle = {
  appearance: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '0 0 auto',
  width: 22,
  height: 22,
  padding: 0,
  border: `1px solid ${TOKENS.borderL2}`,
  borderRadius: RADIUS.xs,
  background: TOKENS.bgLayer1,
  color: TOKENS.labelSecondary,
  fontFamily: TOKENS.fontText,
  fontSize: fontSize(0),
  lineHeight: 1,
  cursor: 'pointer',
}

const carouselCountStyle: CalendarStyle = {
  flex: '0 0 auto',
  minWidth: 34,
  textAlign: 'center',
  fontSize: fontSize(-3.5),
  letterSpacing: 0.4,
  color: TOKENS.labelTertiary,
  fontFamily: TOKENS.fontText,
  fontVariantNumeric: 'tabular-nums',
}

const carouselDotsStyle: CalendarStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 6,
  flex: '1 1 auto',
  paddingLeft: 4,
}

/** 圆点：当前条用品牌色实心 + 描边，其余为边框色空心。 */
function carouselDotStyle(active: boolean): CalendarStyle {
  return {
    appearance: 'none',
    width: active ? 8 : 6,
    height: active ? 8 : 6,
    padding: 0,
    borderRadius: '50%',
    border: active ? `1px solid ${TOKENS.brandPrimary}` : `1px solid ${TOKENS.borderL3}`,
    background: active ? TOKENS.brandPrimary : 'transparent',
    cursor: 'pointer',
    transition: 'width 120ms ease, height 120ms ease, background 120ms ease',
  }
}

const carouselHintStyle: CalendarStyle = {
  marginTop: 8,
  fontSize: fontSize(-4),
  letterSpacing: 0.3,
  color: TOKENS.labelCaption,
  fontFamily: TOKENS.fontText,
}

const eventEmptyStyle: CalendarStyle = {
  fontSize: fontSize(-1.5),
  lineHeight: 1.8,
  color: TOKENS.labelTertiary,
}

const eventEmptyHintStyle: CalendarStyle = {
  display: 'block',
  marginTop: 4,
  fontSize: fontSize(-3.5),
  letterSpacing: 0.3,
  color: TOKENS.labelCaption,
  fontFamily: TOKENS.fontText,
}

const festivalRowStyle: CalendarStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 5,
}

const festivalChipStyle: CalendarStyle = {
  display: 'inline-block',
  padding: '2px 7px',
  borderRadius: 999,
  border: `1px solid ${TOKENS.borderL2}`,
  background: TOKENS.bgModule,
  color: TOKENS.labelSecondary,
  fontSize: fontSize(-3),
  lineHeight: 1.5,
  letterSpacing: 0.3,
}

const footerStyle: CalendarStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
  marginTop: 16,
  paddingTop: 8,
  borderTop: `1px solid ${TOKENS.borderL1}`,
  fontSize: fontSize(-4),
  letterSpacing: 0.3,
  color: TOKENS.labelCaption,
  fontFamily: TOKENS.fontText,
}

function cellStyle(day: CalendarDay, selected: boolean, hovered: boolean): CalendarStyle {
  const base: CalendarStyle = {
    appearance: 'none',
    position: 'relative',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    height: CELL_HEIGHT,
    padding: '2px 0 3px',
    borderRadius: RADIUS.sm,
    border: '1px solid transparent',
    background: 'transparent',
    color: TOKENS.labelPrimary,
    fontFamily: TOKENS.fontText,
    cursor: 'pointer',
    transition: 'background 120ms ease, border-color 120ms ease',
    outline: 'none',
  }
  if (day.isToday) {
    return {
      ...base,
      border: `1px solid ${TOKENS.brandPrimary}`,
      background: TOKENS.interactiveHover,
    }
  }
  if (selected) {
    return {
      ...base,
      border: `1px solid ${TOKENS.borderL3}`,
      background: TOKENS.bgLayer3,
    }
  }
  if (hovered) {
    return { ...base, background: TOKENS.interactiveHover }
  }
  return base
}

function dayNumberStyle(day: CalendarDay): CalendarStyle {
  const base: CalendarStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    borderRadius: '50%',
    fontSize: fontSize(0.5),
    fontWeight: 500,
    lineHeight: 1,
    letterSpacing: 0,
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

function captionStyle(day: CalendarDay): CalendarStyle {
  const base: CalendarStyle = {
    fontSize: fontSize(-3),
    lineHeight: 1.2,
    letterSpacing: 0.1,
    color: TOKENS.labelTertiary,
    whiteSpace: 'nowrap',
  }
  if (day.solarTerm !== undefined) return { ...base, color: TOKENS.brandPrimary, fontWeight: 500 }
  if (day.lunar.lunarDay === 1) return { ...base, color: TOKENS.labelSecondary }
  return base
}

const festivalDotStyle: CalendarStyle = {
  position: 'absolute',
  top: 5,
  right: 5,
  width: 4,
  height: 4,
  borderRadius: '50%',
  background: TOKENS.stateError,
}

/** 月历整页。 */
export function CalendarPanel(): ReactElement {
  const [today, setToday] = useState<CalendarDate>(() => todayDate())
  const [view, setView] = useState<{ year: number; month: number }>(() => {
    const now = todayDate()
    return { year: now.year, month: now.month }
  })
  const [selected, setSelected] = useState<CalendarDate>(() => todayDate())
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const [hoveredNav, setHoveredNav] = useState<string | null>(null)

  // 跨零点自动翻页：日历不能停在昨天。
  useEffect(() => {
    const timer = setInterval(() => {
      const now = todayDate()
      setToday((prev) => (isSameDate(prev, now) ? prev : now))
    }, 30_000)
    return () => clearInterval(timer)
  }, [])

  const header = useMemo(() => buildMonthHeader(view.year, view.month), [view])
  const grid = useMemo(() => buildMonthGrid(view.year, view.month, { today }), [view, today])
  const brief = useMemo(() => buildDayBrief(selected), [selected])

  // ── 历史叙事轮播（0.3.0） ──────────────────────────────────────────────────
  const selectedKey = toDateKey(selected)
  const carouselEvents = brief.events
  const carouselTotal = carouselEvents.length
  const [carousel, dispatchCarousel] = useReducer(carouselReducer, selectedKey, initialCarouselState)
  const [carouselFocused, setCarouselFocused] = useState(false)

  // 切换选中日期 → 回到第 1 条并重置计时。渲染期直接校正（React 官方
  // "adjust state during render" 模式）：不等副作用，避免先闪一条旧日期的条目。
  if (carousel.dateKey !== selectedKey) {
    dispatchCarousel({ type: 'select-date', dateKey: selectedKey })
  }

  const carouselIndex = wrapCarouselIndex(carousel.index, carouselTotal)
  const carouselEvent = carouselEvents[carouselIndex]
  const carouselKind = carouselEvent === undefined ? undefined : eventDateKind(carouselEvent)
  const carouselCount = carouselCountText(carouselIndex, carouselTotal)

  // 自动轮播：8 秒一条。悬停 / 键盘聚焦暂停时不开定时器；手动切换、换日期、
  // 暂停后恢复都会让 timerKey 自增，从而重置计时；卸载时清理。
  useEffect(() => {
    if (carousel.paused || carouselTotal <= 1) return undefined
    const timer = setTimeout(() => {
      dispatchCarousel({ type: 'auto', total: carouselTotal })
    }, CAROUSEL_INTERVAL_MS)
    return () => clearTimeout(timer)
  }, [carousel.paused, carousel.timerKey, carouselTotal])

  const stepCarousel = useCallback(
    (delta: number) => {
      dispatchCarousel({ type: delta > 0 ? 'next' : 'prev', total: carouselTotal })
    },
    [carouselTotal],
  )

  const jumpCarousel = useCallback(
    (index: number) => {
      dispatchCarousel({ type: 'jump', index, total: carouselTotal })
    },
    [carouselTotal],
  )

  const pauseCarousel = useCallback(() => dispatchCarousel({ type: 'pause' }), [])
  const resumeCarousel = useCallback(() => dispatchCarousel({ type: 'resume' }), [])

  // 悬停与键盘聚焦是两个独立来源：任一存在就暂停，两个都离开才恢复。
  // 用 ref 记录（不触发额外渲染），统一收口到 syncCarouselPause。
  const carouselHoveredRef = useRef(false)
  const carouselFocusedRef = useRef(false)
  const syncCarouselPause = useCallback(() => {
    if (carouselHoveredRef.current || carouselFocusedRef.current) pauseCarousel()
    else resumeCarousel()
  }, [pauseCarousel, resumeCarousel])

  const handleCarouselMouseEnter = useCallback(() => {
    carouselHoveredRef.current = true
    syncCarouselPause()
  }, [syncCarouselPause])

  const handleCarouselMouseLeave = useCallback(() => {
    carouselHoveredRef.current = false
    syncCarouselPause()
  }, [syncCarouselPause])

  const handleCarouselFocus = useCallback(() => {
    carouselFocusedRef.current = true
    setCarouselFocused(true)
    syncCarouselPause()
  }, [syncCarouselPause])

  const handleCarouselBlur = useCallback(
    (event: ReactFocusEvent<HTMLDivElement>) => {
      const next = event.relatedTarget as Node | null
      // 焦点还在轮播内部（例如从容器移到「下一条」按钮）时不算离开。
      if (next !== null && event.currentTarget.contains(next)) return
      carouselFocusedRef.current = false
      setCarouselFocused(false)
      syncCarouselPause()
    },
    [syncCarouselPause],
  )

  const handleCarouselKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        stepCarousel(-1)
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        stepCarousel(1)
      }
    },
    [stepCarousel],
  )

  const goToday = useCallback(() => {
    const now = todayDate()
    setToday(now)
    setView({ year: now.year, month: now.month })
    setSelected(now)
  }, [])

  const stepMonth = useCallback((delta: number) => {
    setView((prev) => shiftMonth(prev.year, prev.month, delta))
  }, [])

  const selectDay = useCallback((day: CalendarDay) => {
    setSelected(day.date)
    if (!day.inMonth) {
      setView({ year: day.date.year, month: day.date.month })
    }
  }, [])

  const navButton = (key: string, label: string, onClick: () => void, emphasized = false) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHoveredNav(key)}
      onMouseLeave={() => setHoveredNav(null)}
      style={{
        ...navButtonBase,
        ...(emphasized
          ? {
              border: `1px solid ${TOKENS.brandPrimary}`,
              color: TOKENS.labelPrimaryForeground,
              background: TOKENS.brandPrimary,
            }
          : null),
        ...(hoveredNav === key ? { background: TOKENS.interactiveHover } : null),
      }}
    >
      {label}
    </button>
  )

  return (
    <div data-huaxia-calendar-panel="" style={rootStyle}>
      <div style={frameStyle}>
        <header style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span style={sealStyle} aria-hidden="true">
              華
            </span>
            <div>
              <h1 style={titleStyle}>华夏文明日历</h1>
              <p style={subtitleStyle}>{header.lunarTitle}</p>
            </div>
          </div>
          <div style={navGroupStyle}>
            {navButton('prev', '‹ 上个月', () => stepMonth(-1))}
            {navButton('today', '今天', goToday, true)}
            {navButton('next', '下个月 ›', () => stepMonth(1))}
          </div>
        </header>

        <div style={monthBarStyle}>
          <span style={monthTitleStyle} data-huaxia-month="">
            {header.solarTitle}
          </span>
          <span style={monthMetaStyle}>公历 · 每格下行为农历，节气日以节气名替代</span>
        </div>

        <div style={bodyStyle}>
          <section style={calendarCardStyle}>
            <div style={weekdayRowStyle}>
              {WEEKDAY_SHORT.map((label, weekday) => (
                <span
                  key={label}
                  style={{
                    textAlign: 'center',
                    fontSize: fontSize(-3),
                    letterSpacing: 0.5,
                    color:
                      weekday === 0 || weekday === 6
                        ? TOKENS.labelTertiary
                        : TOKENS.labelSecondary,
                    fontFamily: TOKENS.fontText,
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
            <div style={gridStyle} data-huaxia-grid="">
              {grid.days.map((day) => {
                const key = toDateKey(day.date)
                const selectedDay = isSameDate(day.date, selected)
                const caption = formatCellCaption(day)
                return (
                  <button
                    key={key}
                    type="button"
                    data-huaxia-day=""
                    data-date={key}
                    data-lunar={day.lunar.lunarDayName}
                    aria-label={`${formatSolarDate(day.date)} ${day.lunar.lunarMonthName}${day.lunar.lunarDayName}${
                      day.solarTerm !== undefined ? ` ${day.solarTerm}` : ''
                    }${day.isToday ? ' 今天' : ''}`}
                    aria-current={day.isToday ? 'date' : undefined}
                    onClick={() => selectDay(day)}
                    onMouseEnter={() => setHoveredKey(key)}
                    onMouseLeave={() => setHoveredKey(null)}
                    style={{
                      ...cellStyle(day, selectedDay, hoveredKey === key),
                      ...(day.inMonth ? null : { opacity: 0.34 }),
                    }}
                  >
                    <span style={dayNumberStyle(day)}>{day.date.day}</span>
                    <span style={captionStyle(day)}>{caption}</span>
                    {day.festivals.length > 0 ? <span style={festivalDotStyle} /> : null}
                  </button>
                )
              })}
            </div>
            <div style={hintRowStyle}>
              <span>点击任意日期查看当日一屏</span>
              <span>农历 · 节气 · 干支 — 本地实算，全离线</span>
            </div>
          </section>

          <aside style={briefCardStyle} data-huaxia-brief="">
            <div style={briefHeadStyle}>
              <span style={briefTitleStyle}>
                {isSameDate(selected, today) ? '今日一屏' : '当日一屏'}
              </span>
              <span style={briefWeekdayStyle}>
                {isSameDate(selected, today) ? '今天' : brief.weekdayName}
              </span>
            </div>

            <div style={bigDateStyle}>
              <span style={isSameDate(selected, today) ? bigDayTodayStyle : bigDayStyle}>
                {brief.date.day}
              </span>
              <span style={bigDateMetaStyle}>
                <span>{`${brief.date.year}年${brief.date.month}月`}</span>
                <span style={{ color: TOKENS.labelTertiary }}>{brief.weekdayName}</span>
              </span>
            </div>

            <div style={rowStyle}>
              <span style={rowLabelStyle}>农历</span>
              <span style={rowValueStyle}>{brief.lunar.lunarDateName}</span>
            </div>
            <div style={rowStyle}>
              <span style={rowLabelStyle}>干支</span>
              <span style={rowValueStyle}>{formatGanZhiLine(brief.ganZhi)}</span>
            </div>
            <div style={rowStyle}>
              <span style={rowLabelStyle}>生肖</span>
              <span style={rowValueStyle}>
                {brief.lunar.zodiac} · {brief.lunar.yearGanZhi}年
              </span>
            </div>
            <div style={rowStyle}>
              <span style={rowLabelStyle}>节气</span>
              <span style={rowValueStyle}>
                {formatSolarTermLine(brief, { isToday: isSameDate(selected, today) })}
              </span>
            </div>
            {brief.festivals.length > 0 ? (
              <div style={{ ...rowStyle, alignItems: 'center' }}>
                <span style={rowLabelStyle}>节日</span>
                <span style={{ ...rowValueStyle, ...festivalRowStyle }}>
                  {brief.festivals.map((festival) => (
                    <span
                      key={festival.id}
                      style={
                        festival.isStatutoryHoliday === true
                          ? { ...festivalChipStyle, color: TOKENS.stateError }
                          : festivalChipStyle
                      }
                    >
                      {formatFestivalLabel(festival)}
                    </span>
                  ))}
                </span>
              </div>
            ) : null}

            <div
              style={eventBlockStyle}
              data-huaxia-carousel=""
              data-huaxia-carousel-total={carouselTotal}
              onMouseEnter={handleCarouselMouseEnter}
              onMouseLeave={handleCarouselMouseLeave}
            >
              <div style={carouselHeadStyle}>
                <span style={{ ...eventLabelStyle, marginBottom: 0 }}>
                  {carouselSectionTitle(carouselEvents)}
                </span>
                {carouselTotal > 1 ? (
                  <span
                    data-huaxia-carousel-count=""
                    aria-label={`第 ${carouselIndex + 1} 条，共 ${carouselTotal} 条历史叙事`}
                    style={carouselCountStyle}
                  >
                    {carouselCount}
                  </span>
                ) : null}
              </div>
              {carouselEvent !== undefined ? (
                <>
                  <div
                    data-huaxia-carousel-stage=""
                    role="group"
                    aria-roledescription="轮播"
                    aria-label={`历史叙事轮播：第 ${carouselIndex + 1} 条，共 ${carouselTotal} 条`}
                    tabIndex={0}
                    onFocus={handleCarouselFocus}
                    onBlur={handleCarouselBlur}
                    onKeyDown={handleCarouselKeyDown}
                    style={carouselStageStyle(carouselFocused)}
                  >
                    <div style={carouselChipRowStyle}>
                      <span
                        data-huaxia-carousel-kind={carouselKind}
                        style={eventKindChipStyle(carouselKind === 'exact' ? 'exact' : 'period')}
                      >
                        {formatEventDateKindDetail(carouselEvent)}
                      </span>
                      <span
                        data-huaxia-carousel-region={eventRegion(carouselEvent)}
                        style={eventOriginChipStyle(eventRegion(carouselEvent))}
                      >
                        {formatEventOrigin(carouselEvent)}
                      </span>
                      <span
                        data-huaxia-carousel-category={carouselEvent.category}
                        style={carouselCategoryChipStyle}
                      >
                        {formatEventCategory(carouselEvent.category)}
                      </span>
                    </div>
                    <div style={eventHeadlineStyle}>{formatEventHeadline(carouselEvent)}</div>
                    <p style={eventSummaryStyle}>{carouselEvent.summary}</p>
                    <div style={eventAttributionStyle}>{formatEventAttribution(carouselEvent)}</div>
                  </div>
                  {carouselTotal > 1 ? (
                    <div style={carouselControlsStyle} data-huaxia-carousel-controls="">
                      <button
                        type="button"
                        data-huaxia-carousel-prev=""
                        aria-label="上一条历史叙事"
                        title="上一条历史叙事"
                        onClick={() => stepCarousel(-1)}
                        style={carouselArrowStyle}
                      >
                        ‹
                      </button>
                      <span data-huaxia-carousel-counter="" style={carouselCountStyle}>
                        {carouselCount}
                      </span>
                      <button
                        type="button"
                        data-huaxia-carousel-next=""
                        aria-label="下一条历史叙事"
                        title="下一条历史叙事"
                        onClick={() => stepCarousel(1)}
                        style={carouselArrowStyle}
                      >
                        ›
                      </button>
                      <span style={carouselDotsStyle} role="group" aria-label="轮播条目圆点">
                        {carouselEvents.map((event, index) => (
                          <button
                            key={event.id}
                            type="button"
                            data-huaxia-carousel-dot=""
                            aria-label={`第 ${index + 1} 条历史叙事：${event.title}`}
                            aria-current={index === carouselIndex ? 'true' : undefined}
                            title={`第 ${index + 1} 条：${event.title}`}
                            onClick={() => jumpCarousel(index)}
                            style={carouselDotStyle(index === carouselIndex)}
                          />
                        ))}
                      </span>
                    </div>
                  ) : null}
                  {carouselTotal > 1 ? (
                    <div style={carouselHintStyle}>
                      {carousel.paused
                        ? '自动轮播已暂停 · 移开鼠标或移走焦点后继续'
                        : '每 8 秒自动切换 · 悬停暂停 · ←/→ 切换'}
                    </div>
                  ) : null}
                </>
              ) : (
                <div style={eventEmptyStyle}>
                  今日暂无条目
                  <span style={eventEmptyHintStyle}>
                    内容包按公历月日归档，当前日期尚未收录
                  </span>
                </div>
              )}
            </div>
          </aside>
        </div>

        <footer style={footerStyle}>
          <span>全离线 · 农历/节气由 @shishu/core 本地实算</span>
          <span>{`内容包 ${packManifest.packId} · ${packManifest.packVersion} · ${packManifest.counts.historicalEvents} 条`}</span>
        </footer>
      </div>
    </div>
  )
}
