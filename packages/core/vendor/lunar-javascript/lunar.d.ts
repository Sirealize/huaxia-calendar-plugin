/**
 * 手写的 lunar-javascript v1.7.8 最小类型声明。
 *
 * 只声明 @shishu/core 实际用到的 API（含少量遍历/校验需要的辅助方法）；
 * 上游未提供 TypeScript 类型。若升级 vendor 并用到新 API，请同步补充本文件。
 */

declare interface LunarSolar {
  getYear(): number;
  getMonth(): number;
  getDay(): number;
  getHour(): number;
  getMinute(): number;
  getSecond(): number;
  getWeek(): number;
  getWeekInChinese(): string;
  toYmdHms(): string;
  getLunar(): Lunar;
  next(days: number): LunarSolar;
  getFestivals(): string[];
  getOtherFestivals(): string[];
}

declare interface Lunar {
  getYear(): number;
  getMonth(): number; // 负数表示闰月
  getDay(): number;
  getYearInChinese(): string;
  getMonthInChinese(): string;
  getDayInChinese(): string;
  /** 以农历新年（正月初一）为界的干支纪年 */
  getYearInGanZhi(): string;
  /** 以立春“日期”为界的干支纪年 */
  getYearInGanZhiByLiChun(): string;
  /** 以立春“时刻”为界的干支纪年 */
  getYearInGanZhiExact(): string;
  /** 以节令日期为界的干支纪月 */
  getMonthInGanZhi(): string;
  /** 以节令时刻为界的干支纪月 */
  getMonthInGanZhiExact(): string;
  /** 0 点换日的干支纪日 */
  getDayInGanZhi(): string;
  /** 23 点（子时）换日的干支纪日 */
  getDayInGanZhiExact(): string;
  /** 时辰干支（需要构造时提供小时） */
  getTimeInGanZhi(): string;
  getYearShengXiao(): string;
  getYearShengXiaoByLiChun(): string;
  getYearShengXiaoExact(): string;
  getJieQi(): string;
  getJieQiTable(): Record<string, LunarSolar>;
  getFestivals(): string[];
  getOtherFestivals(): string[];
}

declare interface LunarSolarStatic {
  fromYmd(year: number, month: number, day: number): LunarSolar;
  fromYmdHms(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number,
  ): LunarSolar;
}

declare const lunar: {
  Solar: LunarSolarStatic;
};

export = lunar;
