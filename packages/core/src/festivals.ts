/**
 * 节日命中查询。
 *
 * 节日分三类：
 * 1. 公历固定日（元旦/劳动节/国庆节…）—— 可算；
 * 2. 农历固定日（春节/端午/中秋…）—— 可算；闰月不重复过（例如「闰五月初五」不算法定端午）；
 * 3. 节气日（清明/冬至）—— 可算。
 *
 * 额外：除夕 = 农历年最后一天，可能是腊月廿九或三十，靠"次日是否正月初一"判定，不能写死日期。
 *
 * 不能算的部分：法定节假日**调休安排**、地方性节日、历史纪念日等，必须靠数据层。
 */
import type { DateInput, FestivalInfo, FestivalType } from './types.ts';
import { normalizeDateInput, vendorSolarFromFields } from './engine.ts';
import { solarToLunar } from './calendar.ts';
import { getSolarTermOn } from './solar-terms.ts';

export interface FestivalDefBase {
  /** 稳定 id，用于 UI/内容关联。 */
  id: string;
  name: string;
  type: FestivalType;
  category: string;
  /** 是否中国大陆法定节假日（调休不能算，需数据层）。 */
  isStatutoryHoliday?: boolean;
  description?: string;
}

export interface SolarFestivalDef extends FestivalDefBase {
  type: 'solar';
  month: number;
  day: number;
}

export interface LunarFestivalDef extends FestivalDefBase {
  type: 'lunar';
  month: number;
  day: number;
}

export interface SolarTermFestivalDef extends FestivalDefBase {
  type: 'solar-term';
  term: string;
}

export type FestivalDef = SolarFestivalDef | LunarFestivalDef | SolarTermFestivalDef;

/** 公历固定节日。仅收公历日期确定、无争议的常见节日；地方性节日走数据层。 */
export const SOLAR_FESTIVALS: readonly SolarFestivalDef[] = Object.freeze([
  { id: 'yuan-dan', name: '元旦', type: 'solar', month: 1, day: 1, category: '公历节日', isStatutoryHoliday: true },
  { id: 'qing-ren-jie', name: '情人节', type: 'solar', month: 2, day: 14, category: '公历节日' },
  { id: 'fu-nv-jie', name: '妇女节', type: 'solar', month: 3, day: 8, category: '公历节日' },
  { id: 'zhi-shu-jie', name: '植树节', type: 'solar', month: 3, day: 12, category: '公历节日' },
  { id: 'yu-ren-jie', name: '愚人节', type: 'solar', month: 4, day: 1, category: '公历节日' },
  { id: 'lao-dong-jie', name: '劳动节', type: 'solar', month: 5, day: 1, category: '公历节日', isStatutoryHoliday: true },
  { id: 'qing-nian-jie', name: '青年节', type: 'solar', month: 5, day: 4, category: '公历节日' },
  { id: 'er-tong-jie', name: '儿童节', type: 'solar', month: 6, day: 1, category: '公历节日' },
  { id: 'jian-dang-jie', name: '建党节', type: 'solar', month: 7, day: 1, category: '公历节日' },
  { id: 'jian-jun-jie', name: '建军节', type: 'solar', month: 8, day: 1, category: '公历节日' },
  { id: 'jiao-shi-jie', name: '教师节', type: 'solar', month: 9, day: 10, category: '公历节日' },
  { id: 'guo-qing-jie', name: '国庆节', type: 'solar', month: 10, day: 1, category: '公历节日', isStatutoryHoliday: true },
  { id: 'ping-an-ye', name: '平安夜', type: 'solar', month: 12, day: 24, category: '公历节日' },
  { id: 'sheng-dan-jie', name: '圣诞节', type: 'solar', month: 12, day: 25, category: '公历节日' },
] as const);

/** 农历固定节日（闰月不重复过）。 */
export const LUNAR_FESTIVALS: readonly LunarFestivalDef[] = Object.freeze([
  { id: 'chun-jie', name: '春节', type: 'lunar', month: 1, day: 1, category: '传统节日', isStatutoryHoliday: true },
  { id: 'yuan-xiao-jie', name: '元宵节', type: 'lunar', month: 1, day: 15, category: '传统节日' },
  { id: 'long-tai-tou', name: '龙抬头', type: 'lunar', month: 2, day: 2, category: '传统节日' },
  { id: 'shang-si-jie', name: '上巳节', type: 'lunar', month: 3, day: 3, category: '传统节日' },
  { id: 'duan-wu-jie', name: '端午节', type: 'lunar', month: 5, day: 5, category: '传统节日', isStatutoryHoliday: true },
  { id: 'qi-xi-jie', name: '七夕节', type: 'lunar', month: 7, day: 7, category: '传统节日' },
  { id: 'zhong-yuan-jie', name: '中元节', type: 'lunar', month: 7, day: 15, category: '传统节日' },
  { id: 'zhong-qiu-jie', name: '中秋节', type: 'lunar', month: 8, day: 15, category: '传统节日', isStatutoryHoliday: true },
  { id: 'chong-yang-jie', name: '重阳节', type: 'lunar', month: 9, day: 9, category: '传统节日' },
  { id: 'han-yi-jie', name: '寒衣节', type: 'lunar', month: 10, day: 1, category: '传统节日' },
  { id: 'xia-yuan-jie', name: '下元节', type: 'lunar', month: 10, day: 15, category: '传统节日' },
  { id: 'la-ba-jie', name: '腊八节', type: 'lunar', month: 12, day: 8, category: '传统节日' },
  { id: 'xiao-nian-north', name: '小年（北方·祭灶）', type: 'lunar', month: 12, day: 23, category: '传统节日' },
  { id: 'xiao-nian-south', name: '小年（南方）', type: 'lunar', month: 12, day: 24, category: '传统节日' },
] as const);

/** 节气类节日。 */
export const SOLAR_TERM_FESTIVALS: readonly SolarTermFestivalDef[] = Object.freeze([
  {
    id: 'qing-ming',
    name: '清明节',
    type: 'solar-term',
    term: '清明',
    category: '传统节日',
    isStatutoryHoliday: true,
  },
  {
    id: 'dong-zhi',
    name: '冬至',
    type: 'solar-term',
    term: '冬至',
    category: '节气民俗',
    description: '节气亦是传统节日，南北食俗不同（饺子/汤圆）。',
  },
] as const);

/** 除夕定义：日期不固定，用农历年最后一天判定。 */
export const CHU_XI_DEF: FestivalDefBase = Object.freeze({
  id: 'chu-xi',
  name: '除夕',
  type: 'lunar',
  category: '传统节日',
  isStatutoryHoliday: true,
  description: '农历年最后一天（腊月廿九或三十）。2025 年起为中国大陆法定节假日。',
});

/**
 * 查询某一天的节日（可能为空数组）。
 *
 * 返回顺序：节气类 → 农历传统（含除夕）→ 公历节日。
 * 同一天可能命中多个，例如 2026-02-17 只命中春节；2026-04-05 命中清明节。
 */
export function getFestivals(input: DateInput): FestivalInfo[] {
  const d = normalizeDateInput(input);
  const lunar = solarToLunar(d);
  const out: FestivalInfo[] = [];

  const term = getSolarTermOn(d);
  if (term !== undefined) {
    for (const def of SOLAR_TERM_FESTIVALS) {
      if (def.term === term.name) out.push(toInfo(def));
    }
  }

  if (!lunar.isLeapMonth) {
    for (const def of LUNAR_FESTIVALS) {
      if (def.month === lunar.lunarMonth && def.day === lunar.lunarDay) out.push(toInfo(def));
    }
    if (lunar.lunarMonth === 12) {
      const nextDay = vendorSolarFromFields(d.year, d.month, d.day).next(1).getLunar();
      if (nextDay.getMonth() === 1 && nextDay.getDay() === 1) out.push(toInfo(CHU_XI_DEF));
    }
  }

  for (const def of SOLAR_FESTIVALS) {
    if (def.month === d.month && def.day === d.day) out.push(toInfo(def));
  }

  return out;
}

function toInfo(def: FestivalDefBase): FestivalInfo {
  const info: FestivalInfo = {
    id: def.id,
    name: def.name,
    type: def.type,
    category: def.category,
  };
  if (def.isStatutoryHoliday !== undefined) info.isStatutoryHoliday = def.isStatutoryHoliday;
  if (def.description !== undefined) info.description = def.description;
  return info;
}

/** 全部内置节日定义（供数据层/UI 渲染节日设置页）。 */
export const BUILTIN_FESTIVALS: readonly FestivalDef[] = Object.freeze([
  ...SOLAR_TERM_FESTIVALS,
  ...LUNAR_FESTIVALS,
  CHU_XI_DEF as FestivalDef,
  ...SOLAR_FESTIVALS,
] as const);
