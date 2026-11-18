/**
 * 第三方历法引擎适配层。
 *
 * 这是 @shishu/core 里**唯一**直接 import vendor/lunar-javascript 的模块。
 * 上层业务只依赖本模块和 types.ts，便于将来替换算法（例如自研查表法）
 * 而不动公共 API。
 */
import lunarPkg from '../vendor/lunar-javascript/lunar.js';
import type { DateInput, NormalizedSolarDate } from './types.ts';

/** 北京时间固定 +08:00（中国无夏令时，历史时区问题不在本模块处理范围）。 */
export const BEIJING_UTC_OFFSET_MINUTES = 8 * 60;

/** 已用 HKO 官方历表逐日校验过的年份范围（闭区间）。超出仍可计算，但未做权威校验。 */
export const VERIFIED_YEAR_RANGE = { min: 1901, max: 2100 } as const;

const { Solar } = lunarPkg;

export interface VendorSolar {
  getYear(): number;
  getMonth(): number;
  getDay(): number;
  getHour(): number;
  getMinute(): number;
  getSecond(): number;
  getWeek(): number;
  getWeekInChinese(): string;
  getLunar(): VendorLunar;
  next(days: number): VendorSolar;
  toYmdHms(): string;
  getFestivals(): string[];
  getOtherFestivals(): string[];
}

export interface VendorLunar {
  getYear(): number;
  getMonth(): number;
  getDay(): number;
  getYearInChinese(): string;
  getMonthInChinese(): string;
  getDayInChinese(): string;
  getYearInGanZhi(): string;
  getYearInGanZhiByLiChun(): string;
  getYearInGanZhiExact(): string;
  getMonthInGanZhi(): string;
  getMonthInGanZhiExact(): string;
  getDayInGanZhi(): string;
  getDayInGanZhiExact(): string;
  getTimeInGanZhi(): string;
  getYearShengXiao(): string;
  getYearShengXiaoByLiChun(): string;
  getYearShengXiaoExact(): string;
  getJieQi(): string;
  getJieQiTable(): Record<string, VendorSolar>;
}

function assertInteger(value: number, name: string): void {
  if (!Number.isInteger(value)) {
    throw new TypeError(`[shishu/core] ${name} 必须是整数，收到 ${String(value)}`);
  }
}

function assertNumber(value: number, name: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`[shishu/core] ${name} 必须是有限数字，收到 ${String(value)}`);
  }
}

/**
 * 把 DateInput 归一化成显式公历字段。
 * `Date` 分支按宿主本地时区读取字段（与 `date.getFullYear()` 等一致）。
 */
export function normalizeDateInput(input: DateInput): NormalizedSolarDate {
  if (input instanceof Date) {
    const time = input.getTime();
    if (!Number.isFinite(time)) {
      throw new RangeError('[shishu/core] 收到无效 Date（NaN）');
    }
    return {
      year: input.getFullYear(),
      month: input.getMonth() + 1,
      day: input.getDate(),
      hour: input.getHours(),
      minute: input.getMinutes(),
      second: input.getSeconds(),
    };
  }
  if (typeof input !== 'object' || input === null) {
    throw new TypeError('[shishu/core] 日期入参必须是 Date 或 {year,month,day,...} 对象');
  }
  const { year, month, day } = input;
  const hour = input.hour ?? 0;
  const minute = input.minute ?? 0;
  const second = input.second ?? 0;
  assertInteger(year, 'year');
  assertInteger(month, 'month');
  assertInteger(day, 'day');
  assertInteger(hour, 'hour');
  assertInteger(minute, 'minute');
  assertInteger(second, 'second');
  if (month < 1 || month > 12) {
    throw new RangeError(`[shishu/core] month 必须在 1-12 之间，收到 ${String(month)}`);
  }
  if (day < 1 || day > 31) {
    throw new RangeError(`[shishu/core] day 必须在 1-31 之间，收到 ${String(day)}`);
  }
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
    throw new RangeError('[shishu/core] 时分秒超出合法范围');
  }
  // 校验真实存在的公历日（例如 2026-02-30 应报错而不是静默进位）
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    throw new RangeError(`[shishu/core] 不存在的公历日期：${year}-${month}-${day}`);
  }
  return { year, month, day, hour, minute, second };
}

/** 归一化日期 → vendor Solar 对象。 */
export function toVendorSolar(input: DateInput): VendorSolar {
  const d = normalizeDateInput(input);
  return Solar.fromYmdHms(d.year, d.month, d.day, d.hour, d.minute, d.second);
}

/** 归一化日期 → vendor Lunar 对象。 */
export function toVendorLunar(input: DateInput): VendorLunar {
  return toVendorSolar(input).getLunar();
}

/** 显式公历字段 → vendor Solar 对象（内部高频遍历用，跳过校验）。 */
export function vendorSolarFromFields(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): VendorSolar {
  return Solar.fromYmdHms(year, month, day, hour, minute, second);
}

/**
 * 把北京时间日历字段换算为绝对时刻的 Unix 毫秒。
 * 例：2026-02-04 04:02:08（北京时间）→ 2026-02-03T20:02:08Z。
 */
export function beijingFieldsToEpochMs(d: NormalizedSolarDate): number {
  return (
    Date.UTC(d.year, d.month - 1, d.day, d.hour, d.minute, d.second) -
    BEIJING_UTC_OFFSET_MINUTES * 60_000
  );
}

/** Unix 毫秒 → 北京时间日历字段。 */
export function epochMsToBeijingFields(epochMs: number): NormalizedSolarDate {
  assertNumber(epochMs, 'epochMs');
  const beijing = new Date(epochMs + BEIJING_UTC_OFFSET_MINUTES * 60_000);
  return {
    year: beijing.getUTCFullYear(),
    month: beijing.getUTCMonth() + 1,
    day: beijing.getUTCDate(),
    hour: beijing.getUTCHours(),
    minute: beijing.getUTCMinutes(),
    second: beijing.getUTCSeconds(),
  };
}

/** 北京时间字段格式化为 ISO 8601（带 +08:00）。 */
export function beijingFieldsToIso(d: NormalizedSolarDate): string {
  const p = (n: number, width = 2): string => String(n).padStart(width, '0');
  return `${p(d.year, 4)}-${p(d.month)}-${p(d.day)}T${p(d.hour)}:${p(d.minute)}:${p(d.second)}+08:00`;
}
