/**
 * `<CalendarPanel />` —— 主面板整页月历 + 当日一屏。
 *
 * 宿主无关：只用 React 18 + 内联样式 + 宿主主题 CSS 变量，读不到也不依赖任何
 * DSH API，所以同一个组件可以直接搬进 VS Code webview。
 *
 * 0.2.0：配色全部改为宿主 DSH 主题 token（见 `./theme.ts`），不再自带任何品牌色，
 * light / dark 模式下自动跟随宿主。
 *
 * 数据全部来自 `@shishu/core`（农历/节气/干支/节日本地实算）与
 * `@shishu/content-l1`（每天一条历史叙事）。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactElement } from 'react'
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
  WEEKDAY_SHORT,
  formatCellCaption,
  formatEventAttribution,
  formatEventHeadline,
  formatFestivalLabel,
  formatGanZhiLine,
  formatSolarDate,
  formatSolarTermLine,
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

            <div style={eventBlockStyle}>
              <div style={eventLabelStyle}>历史叙事 · 历史上的今天</div>
              {brief.event !== undefined ? (
                <>
                  <div style={eventHeadlineStyle}>{formatEventHeadline(brief.event)}</div>
                  <p style={eventSummaryStyle}>{brief.event.summary}</p>
                  <div style={eventAttributionStyle}>{formatEventAttribution(brief.event)}</div>
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
