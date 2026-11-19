/**
 * 中文展示格式化纯函数：农历格文案、干支行、节气倒计时、收起态小条、出处署名。
 *
 * 只做「数据 → 文案」的映射，不依赖 React、不依赖任何宿主 API。
 */
import type {
  FestivalInfo,
  GanZhiInfo,
  HistoricalEvent,
  HistoricalEventCategory,
  HistoricalEventDateKind,
  HistoricalEventRegion,
  LicenseId,
  LunarDateInfo,
} from '@shishu/core'
import { dayDiff, type CalendarDate, type CalendarDay, type DayBrief } from './calendar.ts'

/** 星期表头（周首为周日，与 core 的 weekday 0=周日 对齐）。 */
export const WEEKDAY_SHORT = ['日', '一', '二', '三', '四', '五', '六'] as const

/** 浮标文案。 */
export interface PillText {
  /** 大字号：农历月日，如「十月十八」「冬月十八」「闰二月十八」。 */
  primary: string
  /** 小字号：今天有节气就报节气，否则报干支日。 */
  secondary: string
}

/**
 * 农历月名标签：闰月用规范名（「闰二月」），十一/十二月优先用口语别名（冬月/腊月），
 * 其余用规范月名（「正月」「十月」）。
 */
export function lunarMonthLabel(lunar: LunarDateInfo): string {
  if (lunar.isLeapMonth || lunar.lunarMonthAlias === undefined) return lunar.lunarMonthName
  return lunar.lunarMonthAlias
}

/**
 * 月历格子里的农历文案：
 * - 农历初一显示月名（如「十月」「冬月」「闰二月」），否则显示日名（如「十八」「廿九」）。
 * - 节气日的展示由调用方优先用节气名覆盖（见 {@link formatCellCaption}）。
 */
export function formatLunarCell(lunar: LunarDateInfo): string {
  if (lunar.lunarDay === 1) return lunarMonthLabel(lunar)
  return lunar.lunarDayName
}

/** 格子第二行文案：节气优先，其次农历日。 */
export function formatCellCaption(day: CalendarDay): string {
  return day.solarTerm ?? formatLunarCell(day.lunar)
}

/** 「2026年11月18日」。 */
export function formatSolarDate(date: CalendarDate): string {
  return `${date.year}年${date.month}月${date.day}日`
}

/** 「丙午年 · 己亥月 · 丙申日」。 */
export function formatGanZhiLine(ganZhi: GanZhiInfo): string {
  return `${ganZhi.year}年 · ${ganZhi.month}月 · ${ganZhi.day}日`
}

/** 节气交节时刻，「04:52」。 */
export function formatTermMoment(term: { solar: { hour: number; minute: number } }): string {
  return `${String(term.solar.hour).padStart(2, '0')}:${String(term.solar.minute).padStart(2, '0')}`
}

/**
 * 节气一行文案：
 * - 当天交节：「今日交节 · 小雪 · 15:23」（`options.isToday` 为 false 时写「当日交节」）
 * - 否则倒计时：「距「小雪」4 天（11月22日）」
 */
export function formatSolarTermLine(brief: DayBrief, options: { isToday?: boolean } = {}): string {
  const isToday = options.isToday ?? true
  if (brief.solarTerm !== undefined) {
    const lead = isToday ? '今日交节' : '当日交节'
    return `${lead} · ${brief.solarTerm.name} · ${formatTermMoment(brief.solarTerm)}`
  }
  const target: CalendarDate = {
    year: brief.nextSolarTerm.solar.year,
    month: brief.nextSolarTerm.solar.month,
    day: brief.nextSolarTerm.solar.day,
  }
  const days = dayDiff(brief.date, target)
  const when = `${target.month}月${target.day}日`
  if (days <= 0) return `交节 · ${brief.nextSolarTerm.name} · ${when}`
  return `距「${brief.nextSolarTerm.name}」${days} 天（${when}）`
}

/**
 * 收起态小条的两行文案（0.2.0 起由左下角月历的收起态复用）。
 *
 * 中文语序：农历月日 + 「今日某节气」（有节气）或干支年/日（无节气）。
 */
export function formatPill(brief: DayBrief): PillText {
  return {
    primary: `${lunarMonthLabel(brief.lunar)}${brief.lunar.lunarDayName}`,
    secondary:
      brief.solarTerm !== undefined
        ? `今日${brief.solarTerm.name}`
        : `${brief.ganZhi.year}年 · ${brief.ganZhi.day}日`,
  }
}

/**
 * 左下角月历点击某一天后的「一行该日信息」。
 *
 * 内容优先级（越具体越靠前，保证一行里总有信息）：
 * 节气（当日交节）> 节日（含法定节假日角标）> 历史叙事标题 > 下一个节气倒计时。
 * 都没有时退化为「农历 + 干支日」两段，绝不会出现空白行。
 *
 * @param brief - 该日的一屏数据。
 * @param options.isToday - 是否为今天；`false` 时节气文案写「当日交节」而非「今日交节」。
 * @param options.eventIndex - 当天多条历史叙事时展示第几条（0 起，越界回绕）；默认第一条。
 * @returns 形如 `十月初十 · 丙申日 · 北美铁路启用标准时间` 的单行文案。
 */
export function formatMiniDayLine(
  brief: DayBrief,
  options: { isToday?: boolean; eventIndex?: number } = {},
): string {
  const isToday = options.isToday ?? true
  const head = `${lunarMonthLabel(brief.lunar)}${brief.lunar.lunarDayName}`
  const ganZhi = `${brief.ganZhi.day}日`
  const index = options.eventIndex ?? 0
  const event = brief.events?.[index] ?? brief.event

  let tail: string
  let tailIsEvent = false
  if (brief.solarTerm !== undefined) {
    tail = `${isToday ? '今日' : '当日'}交节 · ${brief.solarTerm.name}`
  } else if (brief.festivals.length > 0) {
    tail = brief.festivals.map(formatFestivalLabel).join('、')
  } else if (event !== undefined) {
    tail = event.title
    tailIsEvent = true
  } else {
    tail = formatSolarTermLine(brief, { isToday })
  }
  // 日期口径标记：`period` 条目只是「文明坐标」，不是当天发生，行尾明确标出来。
  const kindMark =
    tailIsEvent && event !== undefined && eventDateKind(event) === 'period' ? ' · 文明坐标' : ''
  return `${head} · ${ganZhi} · ${tail}${kindMark}`
}

/** 节日小标签文案（名称 + 法定节假日角标）。 */
export function formatFestivalLabel(festival: FestivalInfo): string {
  return festival.isStatutoryHoliday === true ? `${festival.name} · 休` : festival.name
}

const LICENSE_LABELS: Readonly<Record<LicenseId, string>> = Object.freeze({
  MIT: 'MIT',
  'Apache-2.0': 'Apache-2.0',
  'CC-BY-4.0': 'CC BY 4.0',
  'CC-BY-SA-4.0': 'CC BY-SA 4.0',
  'CC0-1.0': 'CC0',
  'public-domain': '公有领域',
  'self-authored': '原创整理',
  unknown: '来源待核',
})

/** 许可证 → 中文展示标签。 */
export function licenseLabel(license: LicenseId): string {
  return LICENSE_LABELS[license] ?? LICENSE_LABELS.unknown
}

/** 历史叙事的文明归属中文标签（0.3.0 轮播里用来区分「中华 / 世界」）。 */
export const EVENT_REGION_LABELS: Readonly<Record<HistoricalEventRegion, string>> = Object.freeze({
  china: '中华',
  world: '世界',
})

/**
 * 条目的文明归属：缺省按中华处理（与 `@shishu/content-l1` 的排序口径一致），
 * 只有显式 `region: 'world'` 才算世界条目。
 */
export function eventRegion(event: HistoricalEvent): HistoricalEventRegion {
  return event.region === 'world' ? 'world' : 'china'
}

/** 文明归属标签：「中华」/「世界」。 */
export function formatEventRegion(event: HistoricalEvent): string {
  return EVENT_REGION_LABELS[eventRegion(event)]
}

/**
 * 地域/朝代标签：优先用内容包的 `origin`（如「中国·北宋」「欧洲·意大利」），
 * 缺省时退化为文明归属标签，保证轮播标签位永远不为空。
 */
export function formatEventOrigin(event: HistoricalEvent): string {
  const origin = event.origin?.trim()
  return origin !== undefined && origin.length > 0 ? origin : formatEventRegion(event)
}

/** 历史事件分类的中文标签。 */
export const EVENT_CATEGORY_LABELS: Readonly<Record<HistoricalEventCategory, string>> = Object.freeze({
  political: '政治',
  military: '军事',
  culture: '文化',
  science: '科学',
  technology: '技术',
  economy: '经济',
  society: '社会',
  life: '生活',
  disaster: '灾害',
  sports: '体育',
  other: '其他',
})

/** 分类 → 中文标签；未知分类退化为「其他」，不显示英文枚举值。 */
export function formatEventCategory(category: HistoricalEventCategory): string {
  return EVENT_CATEGORY_LABELS[category] ?? EVENT_CATEGORY_LABELS.other
}

/** 历史叙事的日期口径中文标签。 */
export const EVENT_DATE_KIND_LABELS: Readonly<Record<HistoricalEventDateKind, string>> = Object.freeze({
  exact: '历史上的今天',
  period: '华夏文明坐标',
})

/**
 * 条目的日期口径：缺省按 `period` 处理——宁可标成「文明坐标」，
 * 也不把只按年份/朝代入档的条目谎称成「今天发生」。
 */
export function eventDateKind(event: HistoricalEvent): HistoricalEventDateKind {
  return event.dateKind === 'exact' ? 'exact' : 'period'
}

/** 日期口径的短标签：「历史上的今天」/「华夏文明坐标」。 */
export function formatEventDateKindLabel(event: HistoricalEvent): string {
  return EVENT_DATE_KIND_LABELS[eventDateKind(event)]
}

/**
 * 轮播卡片上的日期口径长标签。
 *
 * - `exact`：`历史上的今天`
 * - `period`：`华夏文明坐标 · <origin> · <yearLabel>`（如「华夏文明坐标 · 中国·北宋 · 960 年」）
 *
 * `period` 带上 origin/yearLabel，避免读者把它误读成「今天发生」。
 */
export function formatEventDateKindDetail(event: HistoricalEvent): string {
  if (eventDateKind(event) === 'exact') return EVENT_DATE_KIND_LABELS.exact
  return `${EVENT_DATE_KIND_LABELS.period} · ${formatEventOrigin(event)} · ${event.yearLabel}`
}

/**
 * 「今日一屏 / 当日一屏」里轮播区块的标题。
 *
 * 刻意不再叫「历史叙事」，避免对 `period`（文明坐标，不是当天发生）条目产生误导：
 * - 当天有 `exact` 条目 → `今日 · 古今中外`（确实有事件发生在今天）
 * - 全部是 `period` → `华夏文明坐标 · 古今中外`（不提「今天」）
 * - 0 条 → `古今中外 · 文明坐标`
 */
export function carouselSectionTitle(events: readonly HistoricalEvent[]): string {
  if (events.length === 0) return '古今中外 · 文明坐标'
  if (events.some((event) => eventDateKind(event) === 'exact')) return '今日 · 古今中外'
  return '华夏文明坐标 · 古今中外'
}

/** 历史叙事的出处行：「中国大百科全书 · 公有领域」。原创条目直接署名「原创整理」。 */
export function formatEventAttribution(event: HistoricalEvent): string {
  const label = licenseLabel(event.license)
  if (event.license === 'self-authored' || event.source === label) return label
  return `${event.source} · ${label}`
}

/** 历史叙事的标题行：「公元前 221 年 · 秦统一六国」。 */
export function formatEventHeadline(event: HistoricalEvent): string {
  return `${event.yearLabel} · ${event.title}`
}
