/**
 * @shishu/core 公共类型定义。
 *
 * 设计原则：
 * 1. 所有时间均为「北京时间的日历字段」（UTC+8），不使用 Date 对象做跨时区换算，
 *    避免宿主机器时区不同导致农历/节气日界漂移。
 * 2. API 只依赖入参，不读写任何全局状态、不访问网络。
 */

/** 公历日期字段。hour/minute/second 缺省为 0。 */
export interface SolarDateInput {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
}

/**
 * API 入参：
 * - 显式字段对象：推荐，语义确定（按北京时间解释）。
 * - `Date`：按**宿主本地时区**读取年/月/日/时/分/秒（等价于 `date.getFullYear()` 等），
 *   在非 UTC+8 机器上可能与北京时间日界不一致；插件宿主（国内用户机器）可接受，
 *   对时区敏感的调用请改用显式字段。
 */
export type DateInput = SolarDateInput | Date;

/** 归一化后的公历日期（字段齐全）。 */
export interface NormalizedSolarDate {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** 农历日期结果。 */
export interface LunarDateInfo {
  /** 农历年（以正月初一为界），如 2026。 */
  lunarYear: number;
  /** 农历月 1-12；闰月时该值为闰月对应的月号，另见 isLeapMonth。 */
  lunarMonth: number;
  /** 农历日 1-30。 */
  lunarDay: number;
  /** 是否闰月。 */
  isLeapMonth: boolean;
  /** 农历年汉字，如「二〇二六」。 */
  lunarYearName: string;
  /** 规范月名，如「正月」「闰四月」「十一月」「十二月」（与香港天文台历表写法一致）。 */
  lunarMonthName: string;
  /** 口语别名：十一月 →「冬月」，十二月 →「腊月」；其余月份为 undefined。 */
  lunarMonthAlias?: string;
  /** 日名，如「初一」「廿九」「三十」。 */
  lunarDayName: string;
  /** 完整农历日期名，如「二〇二六年正月初一」。 */
  lunarDateName: string;
  /** 生肖（春节口径，与农历年一致）。 */
  zodiac: string;
  /** 干支纪年（春节口径，与农历年一致）。 */
  yearGanZhi: string;
  /** 归一化公历日期。 */
  solar: NormalizedSolarDate;
  /** 星期，0=周日 … 6=周六。 */
  weekday: number;
  /** 星期中文，如「星期二」。 */
  weekdayName: string;
  /** 该公历日在当年的序号（1-366）。 */
  dayOfYear: number;
}

/** 干支纪年口径。 */
export type GanZhiYearPolicy =
  /** 默认：以立春「精确时刻」换年（传统历法/命理口径）。 */
  | 'li-chun'
  /** 以立春当天 0 点换年（只看日期，不看时刻）。 */
  | 'li-chun-day'
  /** 以农历正月初一（春节）换年（民间/年俗口径）。 */
  | 'lunar-new-year';

export interface GanZhiOptions {
  /** 年干支口径，默认 'li-chun'。 */
  yearPolicy?: GanZhiYearPolicy;
}

/** 干支与生肖结果。 */
export interface GanZhiInfo {
  /** 按 `yearPolicy` 选出的干支纪年。 */
  year: string;
  /** 本次使用的口径。 */
  yearPolicy: GanZhiYearPolicy;
  /** 立春精确时刻口径的干支年。 */
  yearByLiChun: string;
  /** 立春当天口径的干支年。 */
  yearByLiChunDay: string;
  /** 春节（正月初一）口径的干支年。 */
  yearByLunarNewYear: string;
  /** 干支纪月（以节令精确时刻换月）。 */
  month: string;
  /** 干支纪月（以节令日期换月，不看时刻）。 */
  monthByDay: string;
  /** 干支纪日（0 点换日）。 */
  day: string;
  /** 干支纪日（23 点子时换日）。 */
  dayByZiHour: string;
  /** 时辰干支；未提供 hour 时为 undefined。 */
  hour?: string;
  /** 生肖（跟随 yearPolicy）。 */
  zodiac: string;
  /** 立春精确时刻口径的生肖。 */
  zodiacByLiChun: string;
  /** 春节口径的生肖。 */
  zodiacByLunarNewYear: string;
  /** 归一化公历日期。 */
  solar: NormalizedSolarDate;
}

/** 节气类型：节（12 个）或气（12 个）。 */
export type SolarTermType = '节' | '气';

/** 一个节气（含精确时刻，北京时间 UTC+8）。 */
export interface SolarTerm {
  /** 节气名，如「立春」。 */
  name: string;
  /** 在公历年内按时间排序的序号 1-24（1=小寒 … 24=冬至）。 */
  index: number;
  /** 节/气。 */
  type: SolarTermType;
  /** 太阳视黄经（度）。 */
  longitude: number;
  /** 节气交接的公历日期字段（北京时间）。 */
  solar: NormalizedSolarDate;
  /** 节气交接时刻（北京时间）的 ISO 8601 字符串，含 +08:00。 */
  iso: string;
  /** 节气交接时刻对应的 Unix 毫秒时间戳（绝对时刻）。 */
  epochMs: number;
}

/** 节日来源类型。 */
export type FestivalType = 'solar' | 'lunar' | 'solar-term' | 'custom';

/** 一个节日命中结果。 */
export interface FestivalInfo {
  /** 节日 id，稳定可用于 UI/内容关联，如 `chunjie`。 */
  id: string;
  /** 中文名，如「春节」。 */
  name: string;
  /** 日期规则类型。 */
  type: FestivalType;
  /** 分类，如「传统节日」「公历节日」「节气」。 */
  category: string;
  /** 是否为中国大陆法定节假日（是否调休需另靠数据，不能算）。 */
  isStatutoryHoliday?: boolean;
  /** 一句话说明（可选，来自数据层）。 */
  description?: string;
}
