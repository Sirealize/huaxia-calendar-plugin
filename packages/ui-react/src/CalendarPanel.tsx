/**
 * `<CalendarPanel />` —— 主面板整页月历 + 当日一屏。
 *
 * 宿主无关：只用 React 18 + 内联样式 + CSS 变量，读不到也不依赖任何 DSH API，
 * 所以同一个组件可以直接搬进 VS Code webview。
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
import { PANEL_VARS, PAPER_BACKGROUND, type CalendarStyle } from './theme.ts'

/** 月历格子的固定行高（px）；行数 4–6 由网格自适应。 */
const CELL_HEIGHT = 52

const rootStyle: CalendarStyle = {
  ...PANEL_VARS,
  boxSizing: 'border-box',
  width: '100%',
  minHeight: '100%',
  padding: '22px 26px 20px',
  background: PAPER_BACKGROUND,
  color: 'var(--hx-ink)',
  fontFamily: 'var(--hx-font-serif)',
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
  borderBottom: `2px solid var(--hx-ink)`,
}

const sealStyle: CalendarStyle = {
  width: 30,
  height: 30,
  flex: '0 0 auto',
  borderRadius: 4,
  background: 'var(--hx-cinnabar)',
  color: 'var(--hx-paper-hi)',
  fontFamily: 'var(--hx-font-serif)',
  fontSize: 18,
  lineHeight: '30px',
  textAlign: 'center',
  letterSpacing: 0,
  boxShadow: 'inset 0 0 0 1px rgba(253, 250, 242, 0.35)',
  userSelect: 'none',
}

const titleStyle: CalendarStyle = {
  margin: 0,
  fontSize: 22,
  fontWeight: 600,
  letterSpacing: 3,
  lineHeight: 1.2,
  color: 'var(--hx-ink)',
}

const subtitleStyle: CalendarStyle = {
  margin: '5px 0 0',
  fontSize: 11.5,
  letterSpacing: 1,
  color: 'var(--hx-ink-faint)',
  fontFamily: 'var(--hx-font-sans)',
}

const navGroupStyle: CalendarStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  paddingTop: 2,
}

const navButtonBase: CalendarStyle = {
  appearance: 'none',
  border: '1px solid var(--hx-line)',
  borderRadius: 6,
  background: 'rgba(253, 250, 242, 0.7)',
  color: 'var(--hx-ink-soft)',
  fontFamily: 'var(--hx-font-sans)',
  fontSize: 12,
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
  fontSize: 17,
  fontWeight: 600,
  letterSpacing: 1.5,
  color: 'var(--hx-ink)',
}

const monthMetaStyle: CalendarStyle = {
  fontSize: 11,
  letterSpacing: 1,
  color: 'var(--hx-ink-faint)',
  fontFamily: 'var(--hx-font-sans)',
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
  borderBottom: '1px solid var(--hx-line-soft)',
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
  fontSize: 10.5,
  letterSpacing: 0.6,
  color: 'var(--hx-ink-faint)',
  fontFamily: 'var(--hx-font-sans)',
}

const briefCardStyle: CalendarStyle = {
  flex: '0 1 316px',
  minWidth: 272,
  boxSizing: 'border-box',
  padding: '14px 16px 16px',
  border: '1px solid var(--hx-line)',
  borderRadius: 10,
  background:
    'linear-gradient(180deg, rgba(253, 250, 242, 0.92) 0%, rgba(250, 245, 233, 0.92) 100%)',
  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.7)',
}

const briefHeadStyle: CalendarStyle = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  paddingBottom: 8,
  borderBottom: '1px solid var(--hx-line-soft)',
}

const briefTitleStyle: CalendarStyle = {
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: 2,
  color: 'var(--hx-ink)',
}

const briefWeekdayStyle: CalendarStyle = {
  fontSize: 11,
  letterSpacing: 1,
  color: 'var(--hx-ink-faint)',
  fontFamily: 'var(--hx-font-sans)',
}

const bigDateStyle: CalendarStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 0 6px',
}

const bigDayStyle: CalendarStyle = {
  fontSize: 40,
  fontWeight: 600,
  lineHeight: 1,
  letterSpacing: -1,
  color: 'var(--hx-ink)',
}

const bigDayTodayStyle: CalendarStyle = {
  ...bigDayStyle,
  color: 'var(--hx-cinnabar)',
}

const bigDateMetaStyle: CalendarStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
  fontSize: 12,
  color: 'var(--hx-ink-soft)',
  fontFamily: 'var(--hx-font-sans)',
}

const rowStyle: CalendarStyle = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 8,
  padding: '6px 0',
  borderBottom: '1px dashed var(--hx-line-soft)',
}

const rowLabelStyle: CalendarStyle = {
  flex: '0 0 auto',
  width: 36,
  fontSize: 10.5,
  letterSpacing: 1.5,
  color: 'var(--hx-ink-faint)',
  fontFamily: 'var(--hx-font-sans)',
}

const rowValueStyle: CalendarStyle = {
  flex: '1 1 auto',
  fontSize: 12.5,
  lineHeight: 1.6,
  color: 'var(--hx-ink)',
}

const eventBlockStyle: CalendarStyle = {
  marginTop: 12,
  padding: '11px 12px',
  border: '1px solid var(--hx-line)',
  borderRadius: 8,
  background: 'rgba(255, 255, 255, 0.55)',
}

const eventLabelStyle: CalendarStyle = {
  fontSize: 10.5,
  letterSpacing: 2,
  color: 'var(--hx-cinnabar)',
  fontFamily: 'var(--hx-font-sans)',
  marginBottom: 6,
}

const eventHeadlineStyle: CalendarStyle = {
  fontSize: 13,
  fontWeight: 600,
  lineHeight: 1.55,
  color: 'var(--hx-ink)',
}

const eventSummaryStyle: CalendarStyle = {
  margin: '7px 0 0',
  fontSize: 12,
  lineHeight: 1.85,
  color: 'var(--hx-ink-soft)',
  textAlign: 'justify',
}

const eventAttributionStyle: CalendarStyle = {
  marginTop: 8,
  fontSize: 10,
  letterSpacing: 0.5,
  color: 'var(--hx-ink-faint)',
  fontFamily: 'var(--hx-font-sans)',
}

const eventEmptyStyle: CalendarStyle = {
  fontSize: 12.5,
  lineHeight: 1.8,
  color: 'var(--hx-ink-faint)',
}

const eventEmptyHintStyle: CalendarStyle = {
  display: 'block',
  marginTop: 4,
  fontSize: 10.5,
  letterSpacing: 0.5,
  color: 'var(--hx-ink-faint)',
  fontFamily: 'var(--hx-font-sans)',
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
  border: '1px solid var(--hx-cinnabar-line)',
  background: 'var(--hx-cinnabar-soft)',
  color: 'var(--hx-cinnabar)',
  fontSize: 11,
  lineHeight: 1.5,
  letterSpacing: 0.5,
}

const footerStyle: CalendarStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
  marginTop: 16,
  paddingTop: 8,
  borderTop: '1px solid var(--hx-line)',
  fontSize: 10,
  letterSpacing: 0.6,
  color: 'var(--hx-ink-faint)',
  fontFamily: 'var(--hx-font-sans)',
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
    borderRadius: 7,
    border: '1px solid transparent',
    background: 'transparent',
    color: 'var(--hx-ink)',
    fontFamily: 'var(--hx-font-serif)',
    cursor: 'pointer',
    transition: 'background 120ms ease, border-color 120ms ease',
    outline: 'none',
  }
  if (day.isToday) {
    return {
      ...base,
      border: '1px solid var(--hx-cinnabar-line)',
      background: 'var(--hx-cinnabar-soft)',
    }
  }
  if (selected) {
    return {
      ...base,
      border: '1px solid #bfae8c',
      background: 'rgba(255, 255, 255, 0.62)',
    }
  }
  if (hovered) {
    return { ...base, background: 'rgba(255, 255, 255, 0.72)' }
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
    fontSize: 14.5,
    fontWeight: 500,
    lineHeight: 1,
    letterSpacing: 0,
    color: day.isWeekend ? 'var(--hx-ink-soft)' : 'var(--hx-ink)',
  }
  if (day.isToday) {
    return { ...base, background: 'var(--hx-cinnabar)', color: 'var(--hx-paper-hi)', fontWeight: 700 }
  }
  return base
}

function captionStyle(day: CalendarDay): CalendarStyle {
  const base: CalendarStyle = {
    fontSize: 10.5,
    lineHeight: 1.2,
    letterSpacing: 0.2,
    color: 'var(--hx-ink-faint)',
    whiteSpace: 'nowrap',
  }
  if (day.solarTerm !== undefined) return { ...base, color: 'var(--hx-jade)' }
  if (day.lunar.lunarDay === 1) return { ...base, color: 'var(--hx-cinnabar)' }
  return base
}

const festivalDotStyle: CalendarStyle = {
  position: 'absolute',
  top: 5,
  right: 5,
  width: 4,
  height: 4,
  borderRadius: '50%',
  background: 'var(--hx-cinnabar)',
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
  const grid = useMemo(
    () => buildMonthGrid(view.year, view.month, { today }),
    [view, today],
  )
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
              border: '1px solid var(--hx-cinnabar-line)',
              color: 'var(--hx-cinnabar)',
              background: 'var(--hx-cinnabar-soft)',
            }
          : null),
        ...(hoveredNav === key ? { background: 'var(--hx-paper-lo)' } : null),
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
                    fontSize: 11,
                    letterSpacing: 1,
                    color:
                      weekday === 0 || weekday === 6 ? 'var(--hx-ink-faint)' : 'var(--hx-ink-soft)',
                    fontFamily: 'var(--hx-font-sans)',
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
                <span style={{ color: 'var(--hx-ink-faint)' }}>{brief.weekdayName}</span>
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
                    <span key={festival.id} style={festivalChipStyle}>
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
