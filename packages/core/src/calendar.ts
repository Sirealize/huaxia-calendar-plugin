/**
 * 公历 ↔ 农历、干支/生肖。
 *
 * 干支纪年三种常见口径（本包全部返回，默认走传统历法口径）：
 * 1. `li-chun`（默认）：以立春**精确时刻**换年 —— 《协纪辨方书》/命理/八字口径；
 * 2. `li-chun-day`：以立春**当天 0 点**换年 —— 只看日期的简化口径；
 * 3. `lunar-new-year`：以农历正月初一（春节）换年 —— 民间年俗/多数日历 App 口径。
 *
 * 以 2026 年为例：立春 = 2026-02-04 04:02:08（北京时间），春节 = 2026-02-17。
 * - 2026-02-04 00:00：三种口径依次为 乙巳 / 丙午 / 乙巳（只有"立春当天"口径已换年）；
 * - 2026-02-05 ～ 2026-02-16：丙午 / 丙午 / 乙巳（立春口径已换年，春节口径尚未换年）；
 * - 2026-02-17 起：三者一致为 丙午。
 */
import type {
  DateInput,
  GanZhiInfo,
  GanZhiOptions,
  LunarDateInfo,
  NormalizedSolarDate,
} from './types.ts';
import type { VendorLunar } from './engine.ts';
import { normalizeDateInput, vendorSolarFromFields } from './engine.ts';

const MONTH_BASE_NAMES = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'] as const;
/** 口语别名：十一月=冬月，十二月=腊月（UI 展示用，不参与闰月判定）。 */
const MONTH_ALIAS_NAMES: Readonly<Record<number, string>> = Object.freeze({ 11: '冬月', 12: '腊月' });
const WEEKDAY_NAMES = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'] as const;

function dayOfYear(d: NormalizedSolarDate): number {
  const start = Date.UTC(d.year, 0, 1);
  const current = Date.UTC(d.year, d.month - 1, d.day);
  return Math.round((current - start) / 86_400_000) + 1;
}

/**
 * 公历 → 农历。
 *
 * 农历年/月/日与生肖、干支纪年均为**春节口径**（正月初一换年），
 * 与 `solarToLunar` 展示的"农历二〇二六年正月初一"自洽。
 * 若需要立春口径的干支，请调用 `getGanZhi`。
 */
export function solarToLunar(input: DateInput): LunarDateInfo {
  const d = normalizeDateInput(input);
  const solar = vendorSolarFromFields(d.year, d.month, d.day, d.hour, d.minute, d.second);
  const lunar = solar.getLunar();
  const signedMonth = lunar.getMonth();
  const isLeapMonth = signedMonth < 0;
  const lunarMonth = Math.abs(signedMonth);
  const baseMonthName = MONTH_BASE_NAMES[lunarMonth - 1];
  if (baseMonthName === undefined) {
    throw new Error(`[shishu/core] 非法的农历月：${String(signedMonth)}`);
  }
  const lunarMonthName = `${isLeapMonth ? '闰' : ''}${baseMonthName}月`;
  const aliasBase = MONTH_ALIAS_NAMES[lunarMonth];
  const lunarYearName = lunar.getYearInChinese();
  const lunarDayName = lunar.getDayInChinese();
  const weekday = solar.getWeek();
  return {
    lunarYear: lunar.getYear(),
    lunarMonth,
    lunarDay: lunar.getDay(),
    isLeapMonth,
    lunarYearName,
    lunarMonthName,
    lunarMonthAlias: aliasBase === undefined ? undefined : `${isLeapMonth ? '闰' : ''}${aliasBase}`,
    lunarDayName,
    lunarDateName: `${lunarYearName}年${lunarMonthName}${lunarDayName}`,
    zodiac: lunar.getYearShengXiao(),
    yearGanZhi: lunar.getYearInGanZhi(),
    solar: d,
    weekday,
    weekdayName: WEEKDAY_NAMES[weekday] ?? '',
    dayOfYear: dayOfYear(d),
  };
}

/** 干支纪年口径 → vendor 取数函数。 */
function pickYearGanZhi(
  policy: NonNullable<GanZhiOptions['yearPolicy']>,
  lunar: VendorLunar,
): string {
  switch (policy) {
    case 'li-chun':
      return lunar.getYearInGanZhiExact();
    case 'li-chun-day':
      return lunar.getYearInGanZhiByLiChun();
    case 'lunar-new-year':
      return lunar.getYearInGanZhi();
  }
}

function pickZodiac(
  policy: NonNullable<GanZhiOptions['yearPolicy']>,
  lunar: VendorLunar,
): string {
  switch (policy) {
    case 'li-chun':
      return lunar.getYearShengXiaoExact();
    case 'li-chun-day':
      return lunar.getYearShengXiaoByLiChun();
    case 'lunar-new-year':
      return lunar.getYearShengXiao();
  }
}

/**
 * 干支/生肖。
 *
 * 默认 `yearPolicy: 'li-chun'`（立春精确时刻换年）。
 * 同时返回三种口径的值，方便宿主 UI 切换或在设置里让用户选。
 */
export function getGanZhi(input: DateInput, options: GanZhiOptions = {}): GanZhiInfo {
  const policy = options.yearPolicy ?? 'li-chun';
  if (policy !== 'li-chun' && policy !== 'li-chun-day' && policy !== 'lunar-new-year') {
    throw new RangeError(`[shishu/core] 未知的 yearPolicy：${String(policy)}`);
  }
  const d = normalizeDateInput(input);
  const solar = vendorSolarFromFields(d.year, d.month, d.day, d.hour, d.minute, d.second);
  const lunar = solar.getLunar();
  const hasHour =
    input instanceof Date || (typeof input === 'object' && input !== null && input.hour !== undefined);
  return {
    year: pickYearGanZhi(policy, lunar),
    yearPolicy: policy,
    yearByLiChun: lunar.getYearInGanZhiExact(),
    yearByLiChunDay: lunar.getYearInGanZhiByLiChun(),
    yearByLunarNewYear: lunar.getYearInGanZhi(),
    month: lunar.getMonthInGanZhiExact(),
    monthByDay: lunar.getMonthInGanZhi(),
    day: lunar.getDayInGanZhi(),
    dayByZiHour: lunar.getDayInGanZhiExact(),
    hour: hasHour ? lunar.getTimeInGanZhi() : undefined,
    zodiac: pickZodiac(policy, lunar),
    zodiacByLiChun: lunar.getYearShengXiaoExact(),
    zodiacByLunarNewYear: lunar.getYearShengXiao(),
    solar: d,
  };
}
