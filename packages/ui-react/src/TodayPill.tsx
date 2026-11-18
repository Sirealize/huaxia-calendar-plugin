/**
 * `<TodayPill />` —— 右下角常驻「今日」浮标。
 *
 * 挂在 DSH 的 `shell.overlay`（页面内浮层，本身点击穿透）；这里自己打开
 * `pointer-events`，所以它可点、但不挡下面的聊天区。
 *
 * 只占一小块：农历月日 + 今日节气（无节气时显示干支日）。
 */
import { useEffect, useMemo, useState } from 'react'
import type { ReactElement } from 'react'
import { buildDayBrief, toDateKey, todayDate } from './pure/calendar.ts'
import { formatPill, lunarMonthLabel } from './pure/format.ts'
import { PANEL_VARS, type CalendarStyle } from './theme.ts'

const pillStyle: CalendarStyle = {
  ...PANEL_VARS,
  position: 'fixed',
  right: 18,
  bottom: 18,
  zIndex: 60,
  display: 'flex',
  alignItems: 'center',
  gap: 9,
  boxSizing: 'border-box',
  padding: '7px 12px 7px 9px',
  border: '1px solid var(--hx-line)',
  borderRadius: 10,
  background: 'linear-gradient(180deg, #fdfaf2 0%, #f5eddc 100%)',
  boxShadow: '0 8px 22px rgba(58, 48, 32, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
  color: 'var(--hx-ink)',
  fontFamily: 'var(--hx-font-serif)',
  pointerEvents: 'auto',
  userSelect: 'none',
  cursor: 'default',
}

const barStyle: CalendarStyle = {
  width: 3,
  alignSelf: 'stretch',
  borderRadius: 2,
  background: 'var(--hx-cinnabar)',
}

const primaryStyle: CalendarStyle = {
  fontSize: 13.5,
  fontWeight: 600,
  letterSpacing: 1,
  lineHeight: 1.3,
  color: 'var(--hx-ink)',
}

const secondaryStyle: CalendarStyle = {
  fontSize: 10.5,
  letterSpacing: 0.6,
  lineHeight: 1.35,
  color: 'var(--hx-ink-faint)',
  fontFamily: 'var(--hx-font-sans)',
}

/** 今日浮标。 */
export function TodayPill(): ReactElement {
  const [date, setDate] = useState(() => todayDate())
  const brief = useMemo(() => buildDayBrief(date), [date])

  // 跨零点自动换到新的一天。
  useEffect(() => {
    const timer = setInterval(() => {
      const now = todayDate()
      setDate((prev) => (toDateKey(prev) === toDateKey(now) ? prev : now))
    }, 30_000)
    return () => clearInterval(timer)
  }, [])

  const text = formatPill(brief)

  return (
    <div
      data-huaxia-today-pill=""
      style={pillStyle}
      title={`${brief.lunar.lunarDateName} · ${brief.weekdayName} · ${brief.ganZhi.year}年`}
      aria-label={`${lunarMonthLabel(brief.lunar)}${brief.lunar.lunarDayName}，${brief.solarTerm !== undefined ? `${brief.solarTerm.name}，` : ''}${brief.ganZhi.year}年${brief.ganZhi.day}日`}
    >
      <span style={barStyle} aria-hidden="true" />
      <span style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={primaryStyle}>{text.primary}</span>
        <span style={secondaryStyle}>{text.secondary}</span>
      </span>
    </div>
  )
}
