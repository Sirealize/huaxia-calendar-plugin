/**
 * 二十四节气。
 *
 * 数据来源与口径：
 * - 节气时刻由 vendor/lunar-javascript（寿星天文历算法）计算，**北京时间（UTC+8）**。
 * - 「日期」指该时刻在北京时间下的日历日；与香港天文台（HKO）官方历表口径一致
 *   （HKO《二十四節氣的日期及時間資料》注：时间均为香港时间=UTC+8）。
 *
 * 已验证：
 * - 2026 年 24 个节气日期+分钟与 HKO 官网表格 24/24 一致；
 * - 2026 立春精确时刻 04:02:08，与香港天文学会《香港天文年历 2026》
 *   （04:02:07.9499）相差 <1 秒。
 */
import type { DateInput, NormalizedSolarDate, SolarTerm, SolarTermType } from './types.ts';
import {
  beijingFieldsToEpochMs,
  beijingFieldsToIso,
  epochMsToBeijingFields,
  normalizeDateInput,
  toVendorLunar,
} from './engine.ts';

export interface SolarTermMeta {
  name: string;
  /** 太阳视黄经（度）。 */
  longitude: number;
  type: SolarTermType;
}

/** 24 节气元数据，按公历年内时间顺序（小寒 → 冬至）。 */
export const SOLAR_TERM_META: readonly SolarTermMeta[] = Object.freeze([
  { name: '小寒', longitude: 285, type: '节' },
  { name: '大寒', longitude: 300, type: '气' },
  { name: '立春', longitude: 315, type: '节' },
  { name: '雨水', longitude: 330, type: '气' },
  { name: '惊蛰', longitude: 345, type: '节' },
  { name: '春分', longitude: 0, type: '气' },
  { name: '清明', longitude: 15, type: '节' },
  { name: '谷雨', longitude: 30, type: '气' },
  { name: '立夏', longitude: 45, type: '节' },
  { name: '小满', longitude: 60, type: '气' },
  { name: '芒种', longitude: 75, type: '节' },
  { name: '夏至', longitude: 90, type: '气' },
  { name: '小暑', longitude: 105, type: '节' },
  { name: '大暑', longitude: 120, type: '气' },
  { name: '立秋', longitude: 135, type: '节' },
  { name: '处暑', longitude: 150, type: '气' },
  { name: '白露', longitude: 165, type: '节' },
  { name: '秋分', longitude: 180, type: '气' },
  { name: '寒露', longitude: 195, type: '节' },
  { name: '霜降', longitude: 210, type: '气' },
  { name: '立冬', longitude: 225, type: '节' },
  { name: '小雪', longitude: 240, type: '气' },
  { name: '大雪', longitude: 255, type: '节' },
  { name: '冬至', longitude: 270, type: '气' },
] as const);

const META_BY_NAME = new Map(SOLAR_TERM_META.map((meta) => [meta.name, meta]));

export const SOLAR_TERM_NAMES: readonly string[] = Object.freeze(
  SOLAR_TERM_META.map((meta) => meta.name),
);

/**
 * lunar-javascript 的节气表为避免不同年份同名字典键冲突，
 * 对「下一个年度的前几个节气」使用了英文别名键。映射回标准中文名。
 */
const JIEQI_ALIAS: Readonly<Record<string, string>> = Object.freeze({
  DA_XUE: '大雪',
  DONG_ZHI: '冬至',
  XIAO_HAN: '小寒',
  DA_HAN: '大寒',
  LI_CHUN: '立春',
  YU_SHUI: '雨水',
  JING_ZHE: '惊蛰',
});

function canonicalTermName(tableKey: string): string {
  return JIEQI_ALIAS[tableKey] ?? tableKey;
}

/**
 * 取指定公历年的 24 个节气（含精确时刻，北京时间）。
 *
 * 实现：取当年 6 月 1 日所在农历年的节气表（覆盖上年大雪 → 次年惊蛰），
 * 按公历年份过滤即得该年 24 个节气。若上游数据异常导致不足 24 个，会抛出
 * 明确错误而不是返回残缺数组。
 */
export function getSolarTerms(year: number): SolarTerm[] {
  if (!Number.isInteger(year) || year < 1 || year > 9999) {
    throw new RangeError(`[shishu/core] getSolarTerms 的 year 必须是 1-9999 的整数，收到 ${String(year)}`);
  }
  const table = toVendorLunar({ year, month: 6, day: 1 }).getJieQiTable();
  const picked = new Map<string, { canonicalKey: boolean; solar: NormalizedSolarDate }>();

  for (const [tableKey, solar] of Object.entries(table)) {
    if (solar.getYear() !== year) continue;
    const name = canonicalTermName(tableKey);
    if (!META_BY_NAME.has(name)) continue;
    const isCanonicalKey = JIEQI_ALIAS[tableKey] === undefined;
    const existing = picked.get(name);
    // 同一年份理论上不会同时出现别名与中文键；若出现，优先中文键。
    if (existing === undefined || (isCanonicalKey && !existing.canonicalKey)) {
      picked.set(name, {
        canonicalKey: isCanonicalKey,
        solar: {
          year: solar.getYear(),
          month: solar.getMonth(),
          day: solar.getDay(),
          hour: solar.getHour(),
          minute: solar.getMinute(),
          second: solar.getSecond(),
        },
      });
    }
  }

  if (picked.size !== 24) {
    const missing = SOLAR_TERM_NAMES.filter((name) => !picked.has(name));
    const extra = [...picked.keys()].filter((name) => !META_BY_NAME.has(name));
    throw new Error(
      `[shishu/core] ${year} 年节气数据异常：期望 24 个，实际 ${picked.size} 个；` +
        `缺失 [${missing.join('、')}]，多余 [${extra.join('、')}]`,
    );
  }

  const terms: SolarTerm[] = [];
  for (const [name, entryValue] of picked) {
    const meta = META_BY_NAME.get(name);
    if (meta === undefined) continue;
    terms.push({
      name,
      index: 0, // 排序后统一赋值
      type: meta.type,
      longitude: meta.longitude,
      solar: entryValue.solar,
      iso: beijingFieldsToIso(entryValue.solar),
      epochMs: beijingFieldsToEpochMs(entryValue.solar),
    });
  }
  terms.sort((a, b) => a.epochMs - b.epochMs);
  return terms.map((term, i) => ({ ...term, index: i + 1 }));
}

/** 节气名 → 查询索引，内部用于「当天是否节气」。 */
const TERM_BY_DATE_CACHE = new Map<number, SolarTerm | null>();
const TERM_CACHE_LIMIT = 4096;

/**
 * 查询某个公历日是否为节气日（以北京时间日期为准）。
 * 是则返回该节气，否则返回 undefined。
 */
export function getSolarTermOn(input: DateInput): SolarTerm | undefined {
  const d = normalizeDateInput(input);
  const key = d.year * 10000 + d.month * 100 + d.day;
  const cached = TERM_BY_DATE_CACHE.get(key);
  if (cached !== undefined) return cached ?? undefined;
  const terms = getSolarTerms(d.year);
  const hit =
    terms.find(
      (term) =>
        term.solar.year === d.year && term.solar.month === d.month && term.solar.day === d.day,
    ) ?? null;
  if (TERM_BY_DATE_CACHE.size >= TERM_CACHE_LIMIT) TERM_BY_DATE_CACHE.clear();
  TERM_BY_DATE_CACHE.set(key, hit);
  return hit ?? undefined;
}

function termAbsoluteMs(term: SolarTerm): number {
  return term.epochMs;
}

/**
 * 输入时刻之后的下一个节气（跨年也能取到）。
 * 语义为「严格晚于输入时刻」；若恰好等于交节时刻，返回下一个节气。
 */
export function getNextSolarTerm(input: DateInput): SolarTerm {
  const d = normalizeDateInput(input);
  const inputMs = beijingFieldsToEpochMs(d);
  const years = [d.year, d.year + 1];
  for (const year of years) {
    if (year > 9999) break;
    const candidates = getSolarTerms(year).filter((term) => termAbsoluteMs(term) > inputMs);
    if (candidates.length > 0) return candidates[0] as SolarTerm;
  }
  throw new RangeError('[shishu/core] 无法计算下一个节气（已超出可计算范围）');
}

/**
 * 输入时刻之前的上一个节气（跨年也能取到）。
 * 语义为「严格早于输入时刻」；若恰好等于交节时刻，返回上一个节气。
 */
export function getPreviousSolarTerm(input: DateInput): SolarTerm {
  const d = normalizeDateInput(input);
  const inputMs = beijingFieldsToEpochMs(d);
  const years = [d.year, d.year - 1];
  for (const year of years) {
    if (year < 1) break;
    const candidates = getSolarTerms(year).filter((term) => termAbsoluteMs(term) < inputMs);
    if (candidates.length > 0) return candidates[candidates.length - 1] as SolarTerm;
  }
  throw new RangeError('[shishu/core] 无法计算上一个节气（已超出可计算范围）');
}

/** Unix 毫秒 → 北京时间字段（re-export，方便宿主做时区展示）。 */
export { epochMsToBeijingFields };
