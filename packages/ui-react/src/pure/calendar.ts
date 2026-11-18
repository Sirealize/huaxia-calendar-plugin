/**
 * 日历纯逻辑层：日期算术 + 月网格生成 + 当日一屏取数。
 *
 * 本模块**不依赖 React**，也不读写任何全局状态（`today` 一律由调用方显式传入，
 * 这样测试才可复现）。所有农历 / 节气 / 干支 / 节日数据都来自 `@shishu/core`
 * 的离线本地实算，历史叙事来自 `@shishu/content-l1`。
 */
import {
  getFestivals,
  getGanZhi,
  getNextSolarTerm,
  getSolarTermOn,
  getSolarTerms,
  solarToLunar,
  type FestivalInfo,
  type GanZhiInfo,
  type HistoricalEvent,
  type LunarDateInfo,
  type SolarTerm,
} from '@shishu/core'
import { getEventForDate } from '@shishu/content-l1'

/** 公历日期字段（与 `@shishu/core` 的 SolarDateInput 结构兼容）。 */
export interface CalendarDate {
  year: number
  month: number
  day: number
}

/** 月网格里的一格。 */
export interface CalendarDay {
  date: CalendarDate
  /** 星期，0=周日 … 6=周六。 */
  weekday: number
  /** 是否属于当前展示月（否则是补齐网格用的上/下月日期）。 */
  inMonth: boolean
  isToday: boolean
  isWeekend: boolean
  lunar: LunarDateInfo
  /** 当天节气名（中文，如「小雪」）；非节气日为 undefined。 */
  solarTerm?: string
  festivals: FestivalInfo[]
}

/** 一个月的完整网格（行数按需 4–6 行，每行 7 天）。 */
export interface MonthGrid {
  year: number
  month: number
  days: CalendarDay[]
  weeks: CalendarDay[][]
}

/** 月历表头文案。 */
export interface MonthHeader {
  /** 「2026年11月」 */
  solarTitle: string
  /** 「农历二〇二六年十月 · 丙午马年」 */
  lunarTitle: string
}

/** 当日一屏：公历 + 农历 + 干支 + 节气 + 节日 + 一条历史叙事。 */
export interface DayBrief {
  date: CalendarDate
  weekdayName: string
  lunar: LunarDateInfo
  ganZhi: GanZhiInfo
  /** 当天是节气日时给出该节气。 */
  solarTerm?: SolarTerm
  /** 下一个节气（当天是节气日时也给出，用于倒计时）。 */
  nextSolarTerm: SolarTerm
  festivals: FestivalInfo[]
  /** 当天历史叙事；内容包未收录时为 undefined（UI 必须优雅降级）。 */
  event?: HistoricalEvent
}

const MS_PER_DAY = 86_400_000

/** 取「今天」的公历字段（宿主本地时区；与 core 的 Date 入参口径一致）。 */
export function todayDate(now: Date = new Date()): CalendarDate {
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() }
}

/** 稳定的日期键，用于 React key / 比较 / 查询。 */
export function toDateKey(date: CalendarDate): string {
  return `${date.year}-${date.month}-${date.day}`
}

export function isSameDate(a: CalendarDate, b: CalendarDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day
}

/** 指定公历月的天数。 */
export function daysInMonth(year: number, month: number): number {
  assertMonth(month)
  // Date.UTC 的第 0 天 = 上个月最后一天
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** 相对 1970-01-01 的天序号（只用于求日期差，不涉及时区）。 */
export function toDayNumber(date: CalendarDate): number {
  return Math.round(Date.UTC(date.year, date.month - 1, date.day) / MS_PER_DAY)
}

/** 日期加减天数。 */
export function addDays(date: CalendarDate, delta: number): CalendarDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + delta))
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  }
}

/** `to - from` 的天数差（正数表示 to 在 from 之后）。 */
export function dayDiff(from: CalendarDate, to: CalendarDate): number {
  return toDayNumber(to) - toDayNumber(from)
}

/** 月份平移（跨年自动进位/借位）。 */
export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  assertMonth(month)
  const total = year * 12 + (month - 1) + delta
  return { year: Math.floor(total / 12), month: (((total % 12) + 12) % 12) + 1 }
}

/**
 * 生成月网格。
 *
 * - 周首为周日（与 `solarToLunar().weekday` 的 0=周日 对齐）。
 * - 行数按需要 4–6 行；不在当月的补齐日期 `inMonth=false`，仍带真实农历数据。
 * - `options.today` 显式传入「今天」，不传则取宿主本地时区的当前日期。
 */
export function buildMonthGrid(
  year: number,
  month: number,
  options: { today?: CalendarDate } = {},
): MonthGrid {
  assertMonth(month)
  const today = options.today
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const weekCount = Math.ceil((firstWeekday + daysInMonth(year, month)) / 7)
  const start = addDays({ year, month, day: 1 }, -firstWeekday)

  const dates: CalendarDate[] = []
  for (let i = 0; i < weekCount * 7; i += 1) dates.push(addDays(start, i))

  // 网格会跨到上/下月，按实际涉及的年份取节气表，避免拿相邻年节气时漏项。
  const termByKey = new Map<string, string>()
  for (const termYear of new Set(dates.map((date) => date.year))) {
    for (const term of getSolarTerms(termYear)) {
      termByKey.set(
        toDateKey({ year: term.solar.year, month: term.solar.month, day: term.solar.day }),
        term.name,
      )
    }
  }

  const days: CalendarDay[] = dates.map((date) => {
    const lunar = solarToLunar(date)
    const term = termByKey.get(toDateKey(date))
    const day: CalendarDay = {
      date,
      weekday: lunar.weekday,
      inMonth: date.month === month && date.year === year,
      isToday: today !== undefined && isSameDate(date, today),
      isWeekend: lunar.weekday === 0 || lunar.weekday === 6,
      lunar,
      festivals: getFestivals(date),
    }
    if (term !== undefined) day.solarTerm = term
    return day
  })

  const weeks: CalendarDay[][] = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))

  return { year, month, days, weeks }
}

/** 月历表头：取月中（15 日）的农历年/月与干支年，避免月初跨月的歧义。 */
export function buildMonthHeader(year: number, month: number): MonthHeader {
  assertMonth(month)
  const lunar = solarToLunar({ year, month, day: 15 })
  return {
    solarTitle: `${year}年${month}月`,
    lunarTitle: `农历${lunar.lunarYearName}年${lunar.lunarMonthName} · ${lunar.yearGanZhi}${lunar.zodiac}年`,
  }
}

/**
 * 当日一屏取数。传入 `Date` 时按宿主本地时区读字段；传入 `CalendarDate` 时可复现。
 */
export function buildDayBrief(input: CalendarDate | Date): DayBrief {
  const date = input instanceof Date ? todayDate(input) : input
  const lunar = solarToLunar(date)
  return {
    date,
    weekdayName: lunar.weekdayName,
    lunar,
    ganZhi: getGanZhi(date),
    solarTerm: getSolarTermOn(date),
    nextSolarTerm: getNextSolarTerm(date),
    festivals: getFestivals(date),
    event: getEventForDate(date.month, date.day),
  }
}

function assertMonth(month: number): void {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError(`[shishu/ui-react] 月份必须是 1-12 的整数，收到 ${String(month)}`)
  }
}
