#!/usr/bin/env node
/**
 * 可选：联网交叉校验（不属于 node --test 的离线测试套件）。
 *
 * 用香港天文台（HKO）官方《公曆與農曆日期對照表》逐日核对 @shishu/core 的
 * 农历日期与节气日期（1901-2100）。
 *
 * 运行：
 *   node scripts/verify-against-hko.mjs             # 默认 1901-2100
 *   node scripts/verify-against-hko.mjs 1901 1950   # 指定年份区间
 *
 * HKO 官方文本历表：
 *   https://www.hko.gov.hk/tc/gts/time/calendar/text/files/T{year}c.txt
 * 注意：HKO 对无 User-Agent 的批量请求会拒绝，脚本已带 UA 并做串行限速。
 *
 * 结论口径：HKO 历表是权威数据，若与库不一致会逐条列出，需人工判断
 * （历史历书在午夜新月边界存在不同数据源分歧，见 docs/evaluation/核心算法可行性.md）。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getSolarTerms, solarToLunar } from '../src/index.ts';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const CACHE_DIR = process.env.HKO_CACHE ?? join(tmpdir(), 'shishu-hko-cache');
const DEFAULT_START = 1901;
const DEFAULT_END = 2100;

/** 繁体（HKO）→ 简体（@shishu/core）。 */
const TERM_TRAD_TO_SIMP = new Map([
  ['驚蟄', '惊蛰'],
  ['穀雨', '谷雨'],
  ['處暑', '处暑'],
  ['小滿', '小满'],
  ['芒種', '芒种'],
]);

const CN_DIGITS = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
const MONTH_NAMES = {
  正: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
  十一: 11, 十二: 12, 冬: 11, 腊: 12, 臘: 12,
};

/** 解析 HKO 农历日期字段：如「正月」「閏四月」「廿二」「三十」。日字段不含月份时 month 为 null。 */
function parseLunarField(field) {
  const leap = field.startsWith('閏');
  const body = leap ? field.slice(1) : field;
  if (body.endsWith('月')) {
    const month = MONTH_NAMES[body.slice(0, -1)];
    if (month === undefined) throw new Error(`无法解析农历月「${field}」`);
    return { month, day: 1, leap };
  }
  if (body === '三十') return { month: null, day: 30, leap };
  if (body.startsWith('十')) {
    const rest = body.slice(1);
    if (rest === '') return { month: null, day: 10, leap };
    const d = CN_DIGITS[rest];
    if (d === undefined) throw new Error(`无法解析农历日「${field}」`);
    return { month: null, day: 10 + d, leap };
  }
  if (body === '二十') return { month: null, day: 20, leap };
  if (body.startsWith('廿')) {
    const d = CN_DIGITS[body.slice(1)];
    if (d === undefined) throw new Error(`无法解析农历日「${field}」`);
    return { month: null, day: 20 + d, leap };
  }
  if (body.startsWith('初')) {
    const d = CN_DIGITS[body.slice(1)];
    if (d === undefined) throw new Error(`无法解析农历日「${field}」`);
    return { month: null, day: d, leap };
  }
  const d = CN_DIGITS[body];
  if (d === undefined) throw new Error(`无法解析农历日「${field}」`);
  return { month: null, day: d, leap };
}

function normalizeTerm(raw) {
  const cleaned = raw.trim().replace(/[:：].*$/, '');
  return TERM_TRAD_TO_SIMP.get(cleaned) ?? cleaned;
}

async function fetchYear(year) {
  mkdirSync(CACHE_DIR, { recursive: true });
  const cachePath = join(CACHE_DIR, `T${year}c.txt`);
  if (existsSync(cachePath)) return readFileSync(cachePath, 'utf8');
  if (process.env.HKO_OFFLINE === '1') throw new Error('离线模式：缓存中没有该年份');
  const url = `https://www.hko.gov.hk/tc/gts/time/calendar/text/files/T${year}c.txt`;
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      if (text.length < 1000) throw new Error(`响应过短（${text.length} B）`);
      writeFileSync(cachePath, text);
      await new Promise((resolve) => setTimeout(resolve, 120));
      return text;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
  throw new Error(`下载 ${year} 年 HKO 历表失败：${String(lastError)}`);
}

function parseYear(text, year) {
  const rows = [];
  const lineRe = /^(\d{4})年(\d{1,2})月(\d{1,2})日\s+(\S+)\s+(星期[日一二三四五六])\s*(.*)$/;
  for (const line of text.split(/\r?\n/)) {
    const match = lineRe.exec(line);
    if (!match) continue;
    const [, yText, mText, dText, lunarField, , rest] = match;
    if (Number(yText) !== year) continue;
    rows.push({
      year,
      month: Number(mText),
      day: Number(dText),
      lunarField,
      term: normalizeTerm(rest),
    });
  }
  return rows;
}

const termCache = new Map();
function termNameForDate(year, month, day) {
  let terms = termCache.get(year);
  if (terms === undefined) {
    terms = getSolarTerms(year);
    termCache.set(year, terms);
  }
  return terms.find((t) => t.solar.month === month && t.solar.day === day)?.name;
}

async function main() {
  const start = Number(process.argv[2] ?? DEFAULT_START);
  const end = Number(process.argv[3] ?? DEFAULT_END);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start > end) {
    console.error('用法: node scripts/verify-against-hko.mjs [起始年] [结束年]');
    process.exit(2);
  }
  console.log(`== 用 HKO 官方历表校验 @shishu/core（${start}-${end}）==`);
  console.log(`node ${process.version}；缓存目录 ${CACHE_DIR}`);

  let comparedDays = 0;
  let dayOnlyCompared = 0;
  let comparedTerms = 0;
  let parseErrors = 0;
  const lunarMismatches = [];
  const termMismatches = [];
  /** 当前农历月上下文（HKO 日字段不含月份，只有每月初一写月名）。 */
  let current = null;

  for (let year = start; year <= end; year += 1) {
    let rows;
    try {
      rows = parseYear(await fetchYear(year), year);
      process.stdout.write(`\r已下载/解析 ${String(year)} 年（${String(rows.length)} 天）…`);
    } catch (error) {
      console.error(`\n跳过 ${year} 年：${String(error)}`);
      continue;
    }
    for (const row of rows) {
      comparedDays += 1;
      let hko;
      try {
        hko = parseLunarField(row.lunarField);
      } catch (error) {
        parseErrors += 1;
        continue;
      }
      if (hko.month !== null) current = { month: hko.month, leap: hko.leap };
      if (current === null) {
        dayOnlyCompared += 1; // 起始年份年初的残月，HKO 未写月名，仅比较日
        continue;
      }

      const lunar = solarToLunar({ year: row.year, month: row.month, day: row.day });
      if (lunar.lunarDay !== hko.day) {
        lunarMismatches.push({
          date: `${row.year}-${String(row.month).padStart(2, '0')}-${String(row.day).padStart(2, '0')}`,
          field: 'day',
          hko: `${current.leap ? '闰' : ''}${current.month}月${hko.day}日`,
          lib: `${lunar.isLeapMonth ? '闰' : ''}${lunar.lunarMonth}月${lunar.lunarDay}日`,
        });
      } else if (lunar.lunarMonth !== current.month || lunar.isLeapMonth !== current.leap) {
        lunarMismatches.push({
          date: `${row.year}-${String(row.month).padStart(2, '0')}-${String(row.day).padStart(2, '0')}`,
          field: 'month',
          hko: `${current.leap ? '闰' : ''}${current.month}月${hko.day}日`,
          lib: `${lunar.isLeapMonth ? '闰' : ''}${lunar.lunarMonth}月${lunar.lunarDay}日`,
        });
      }

      if (row.term !== '') {
        comparedTerms += 1;
        const libTerm = termNameForDate(row.year, row.month, row.day);
        if (libTerm !== row.term) {
          termMismatches.push({
            date: `${row.year}-${String(row.month).padStart(2, '0')}-${String(row.day).padStart(2, '0')}`,
            hko: row.term,
            lib: libTerm ?? '(无)',
          });
        }
      }
    }
  }
  process.stdout.write('\n');

  console.log('');
  console.log(`农历逐日比较: ${String(comparedDays)} 天（其中 ${String(dayOnlyCompared)} 天因 HKO 未写月名只比较日号），不一致 ${String(lunarMismatches.length)} 天`);
  if (lunarMismatches.length > 0) {
    const byRange = new Map();
    for (const mismatch of lunarMismatches) {
      const key = mismatch.date.slice(0, 7);
      byRange.set(key, (byRange.get(key) ?? 0) + 1);
    }
    console.log(`  不一致日期（月份计数）: ${[...byRange.entries()].map(([k, v]) => `${k}(${String(v)} 天)`).join(', ')}`);
    for (const mismatch of lunarMismatches.slice(0, 20)) {
      console.log(`  - ${mismatch.date} [${mismatch.field}]: HKO=${mismatch.hko} / core=${mismatch.lib}`);
    }
    if (lunarMismatches.length > 20) console.log(`  …其余 ${String(lunarMismatches.length - 20)} 天略`);
  }
  console.log(`节气日期比较: ${String(comparedTerms)} 个，不一致 ${String(termMismatches.length)} 个`);
  for (const mismatch of termMismatches.slice(0, 20)) {
    console.log(`  - ${mismatch.date}: HKO=${mismatch.hko} / core=${mismatch.lib}`);
  }
  if (parseErrors > 0) console.log(`解析失败行: ${String(parseErrors)}`);
  const ok = lunarMismatches.length === 0 && termMismatches.length === 0;
  console.log(ok ? '结论: 全部一致 ✅' : '结论: 存在不一致，需人工复核 ⚠️');
  process.exit(ok ? 0 : 1);
}

await main();
