/**
 * 内容数据层 Schema（历史事件 / 64 卦 / 自定义节日 / 内容包）。
 *
 * 边界铁律：
 * - **算法算得出来**的：公历↔农历、节气（含精确时刻）、干支、生肖、节日日期、除夕日期。
 * - **算法算不出来、必须靠数据**的：历史事件文本与年份、卦辞/爻辞/白话解读、
 *   节日描述、法定节假日调休安排。
 *
 * 许可证铁律：
 * - 「历史上的今天」类公开数据集大量转自维基百科（CC BY-SA 4.0）。一旦随安装包分发，
 *   即触发**署名 + 相同方式共享（ShareAlike）**义务。
 * - 因此 `HistoricalEvent` 的 `source`（来源名）、`sourceUrl`（可选）、`license` 是
 *   **强制字段**，不是可选项；缺少即视为数据不合格（见 `validate.ts`）。
 * - 若产品不能履行 CC BY-SA 的传染性义务（例如不允许派生内容以 CC BY-SA 分发），
 *   必须二选一：改为 self-authored 原创文案，或把该类内容做成**运行时可选的在线/订阅数据**
 *   而非随包分发。详见 docs/evaluation/核心算法可行性.md「数据 schema」一节。
 */

/** 支持的许可证标识。未知来源必须显式标注 'unknown' 并在发布前清零。 */
export type LicenseId =
  | 'MIT'
  | 'Apache-2.0'
  | 'CC-BY-4.0'
  | 'CC-BY-SA-4.0'
  | 'CC0-1.0'
  | 'public-domain'
  | 'self-authored'
  | 'unknown';

/** 历史事件分类。 */
export type HistoricalEventCategory =
  | 'political'
  | 'military'
  | 'culture'
  | 'science'
  | 'technology'
  | 'economy'
  | 'society'
  | 'life'
  | 'disaster'
  | 'sports'
  | 'other';

/** 一条「历史上的今天」事件（L1 内容包核心数据）。 */
export interface HistoricalEvent {
  /** 稳定 id，建议 `he-<MMDD>-<序号>`，如 `he-0217-001`。 */
  id: string;
  /** 归档键：公历月日（1-12 月 / 1-31 日）。跨年每天都有对应事件。 */
  solar: { month: number; day: number };
  /** 事件发生年份（负数表示公元前，如 -221）。 */
  eventYear: number;
  /** 年份展示文案，如「公元前 221 年」「1949 年」。 */
  yearLabel: string;
  /** 标题（8-20 字）。 */
  title: string;
  /** 摘要（建议 60-140 字）。 */
  summary: string;
  category: HistoricalEventCategory;
  /** 检索/展示标签，2-5 个。 */
  tags?: string[];
  /** 同一天多条事件时的排序权重，0-100，越大越靠前。 */
  weight?: number;
  /** 来源名：如「维基百科」「中国大百科全书」「原创」。**强制**。 */
  source: string;
  /** 来源链接。**可选**，但来自网页/数据库时强烈建议填写以便审计。 */
  sourceUrl?: string;
  /** 许可证标识。**强制**。 */
  license: LicenseId;
  /** 署名文案（CC BY-SA 等要求展示作者/来源时使用）。 */
  attribution?: string;
  /** 抓取/撰写日期（ISO 8601 日期），用于内容溯源。 */
  retrievedAt?: string;
}

/** 六十四卦中的一卦。 */
export interface Hexagram {
  /** 卦序 1-64（周易通行本序）。 */
  id: number;
  /** 卦名，如「乾」「屯」。 */
  name: string;
  /** Unicode 卦象符号，如「䷀」。 */
  symbol: string;
  /** 六爻阴阳，自下而上，1=阳爻、0=阴爻；如乾 = "111111"。 */
  binary: string;
  /** 下卦（内卦）名，如「震」。 */
  lowerTrigram?: string;
  /** 上卦（外卦）名，如「坎」。 */
  upperTrigram?: string;
  /** 卦辞（《周易》原文，公有领域）。 */
  guaCi: string;
  /** 彖辞。 */
  tuanCi?: string;
  /** 象辞（大象）。 */
  xiangCi?: string;
  /** 六条爻辞，自初爻至上爻，共 6 条。 */
  yaoCi: string[];
  /** 用九/用六（仅乾、坤两卦）。 */
  yongCi?: string;
  /** 白话解读（**必须原创或取得授权**，不得直接翻译受版权保护的白话本）。 */
  interpretation: string;
  /** 主题标签，如「刚健」「进取」。 */
  themes: string[];
  source: string;
  sourceUrl?: string;
  license: LicenseId;
  attribution?: string;
}

/** 自定义节日规则（L1 内容包可扩展内置节日之外的条目）。 */
export type FestivalRule =
  /** 公历固定月日。 */
  | { kind: 'solar-fixed'; month: number; day: number }
  /** 农历固定月日；闰月默认不过节。 */
  | { kind: 'lunar-fixed'; month: number; day: number; allowLeap?: boolean }
  /** 节气日。 */
  | { kind: 'solar-term'; term: string }
  /** 公历第 n 个星期 w（如母亲节 = 5 月第 2 个星期日，n 从 1 起，weekday 0=周日）。 */
  | { kind: 'nth-weekday'; month: number; weekday: number; nth: number };

/** 内容包中的自定义节日。 */
export interface CustomFestivalDef {
  id: string;
  name: string;
  rule: FestivalRule;
  category: string;
  description?: string;
  /** 是否法定节假日（调休安排仍不能算）。 */
  isStatutoryHoliday?: boolean;
  source: string;
  sourceUrl?: string;
  license: LicenseId;
  attribution?: string;
}

/** 内容包清单（manifest.json）。 */
export interface ContentPackManifest {
  /** 数据 schema 版本，当前 '1.0.0'。 */
  schemaVersion: '1.0.0';
  /** 内容包 id，如 `l1-core`。 */
  packId: string;
  /** 内容包版本，如 `2026.1.0`。 */
  packVersion: string;
  /** 内容包标题。 */
  title: string;
  /** 生成时间（ISO 8601）。 */
  generatedAt: string;
  /** 内容包整体许可证（若混用，必须逐条标注）。 */
  license: LicenseId;
  /** 条目计数。 */
  counts: {
    historicalEvents: number;
    hexagrams: number;
    festivals: number;
  };
  /** 内容覆盖范围（公历年，闭区间）与是否逐日覆盖 366 天。 */
  coverage: {
    years: [number, number];
    dayOfYearCoverage: 'full' | 'partial';
  };
  /** 数据文件清单。 */
  files: Array<{
    /** 相对包根目录的路径。 */
    path: string;
    /** 文件字节数。 */
    bytes: number;
    /** sha256（十六进制小写）。 */
    sha256: string;
    /** 记录数。 */
    recordCount: number;
  }>;
  /** 必须随包展示的署名/版权声明。 */
  attribution: string;
}

/** L1 内容包（manifest + 三类数据）。 */
export interface L1ContentPack {
  manifest: ContentPackManifest;
  historicalEvents: HistoricalEvent[];
  hexagrams: Hexagram[];
  festivals: CustomFestivalDef[];
}

/** 当前数据 schema 版本常量。 */
export const CONTENT_SCHEMA_VERSION = '1.0.0' as const;
