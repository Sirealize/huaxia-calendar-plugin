import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getSolarTerms,
  getSolarTermOn,
  getNextSolarTerm,
  getPreviousSolarTerm,
  SOLAR_TERM_NAMES,
  type SolarTerm,
} from '../src/index.ts';

/**
 * 香港天文台《二十四節氣的日期及時間資料》2026 年官方表（香港時間 = UTC+8）。
 * 来源：https://www.hko.gov.hk/tc/gts/astronomy/Solar_Term.htm
 * HKO 时间只显示到分钟（四舍五入），故比对时把秒四舍五入到分钟。
 */
const HKO_2026: ReadonlyArray<readonly [string, number, number, number, number]> = [
  ['小寒', 1, 5, 16, 23],
  ['大寒', 1, 20, 9, 45],
  ['立春', 2, 4, 4, 2],
  ['雨水', 2, 18, 23, 52],
  ['惊蛰', 3, 5, 21, 59],
  ['春分', 3, 20, 22, 46],
  ['清明', 4, 5, 2, 40],
  ['谷雨', 4, 20, 9, 39],
  ['立夏', 5, 5, 19, 49],
  ['小满', 5, 21, 8, 37],
  ['芒种', 6, 5, 23, 48],
  ['夏至', 6, 21, 16, 25],
  ['小暑', 7, 7, 9, 57],
  ['大暑', 7, 23, 3, 13],
  ['立秋', 8, 7, 19, 43],
  ['处暑', 8, 23, 10, 19],
  ['白露', 9, 7, 22, 41],
  ['秋分', 9, 23, 8, 5],
  ['寒露', 10, 8, 14, 29],
  ['霜降', 10, 23, 17, 38],
  ['立冬', 11, 7, 17, 52],
  ['小雪', 11, 22, 15, 23],
  ['大雪', 12, 7, 10, 53],
  ['冬至', 12, 22, 4, 50],
];

function findTerm(terms: SolarTerm[], name: string): SolarTerm {
  const term = terms.find((t) => t.name === name);
  assert.ok(term, `未找到节气 ${name}`);
  return term;
}

test('2026 年 24 个节气：数量、顺序、节/气分类', () => {
  const terms = getSolarTerms(2026);
  assert.equal(terms.length, 24);
  assert.deepEqual(
    terms.map((t) => t.name),
    [...SOLAR_TERM_NAMES],
  );
  assert.deepEqual(
    terms.map((t) => t.index),
    Array.from({ length: 24 }, (_, i) => i + 1),
  );
  assert.equal(terms.filter((t) => t.type === '节').length, 12);
  assert.equal(terms.filter((t) => t.type === '气').length, 12);
  // 严格递增
  for (let i = 1; i < terms.length; i += 1) {
    assert.ok((terms[i]?.epochMs ?? 0) > (terms[i - 1]?.epochMs ?? 0));
  }
});

test('2026 全部 24 个节气与香港天文台官方表逐条一致（日期 + 四舍五入到分钟）', () => {
  const terms = getSolarTerms(2026);
  assert.equal(terms.length, HKO_2026.length);
  let matched = 0;
  for (const [name, month, day, hh, mm] of HKO_2026) {
    const term = findTerm(terms, name);
    assert.equal(term.solar.month, month, `${name} 月`);
    assert.equal(term.solar.day, day, `${name} 日`);
    const roundedMinutes =
      term.solar.hour * 60 + term.solar.minute + Math.round(term.solar.second / 60);
    assert.equal(roundedMinutes, hh * 60 + mm, `${name} HKO ${String(hh)}:${String(mm)}`);
    matched += 1;
  }
  assert.equal(matched, 24);
});

test('2026 立春 = 2026-02-04 04:02:08（北京时间），与香港天文学会年历差 <2 秒', () => {
  const lichun = findTerm(getSolarTerms(2026), '立春');
  assert.deepEqual(
    [lichun.solar.year, lichun.solar.month, lichun.solar.day],
    [2026, 2, 4],
  );
  assert.equal(lichun.solar.hour, 4);
  assert.equal(lichun.solar.minute, 2);
  assert.equal(lichun.iso, '2026-02-04T04:02:08+08:00');
  // 香港天文学会《香港天文年历 2026》：2026-02-04 04:02:07.9499（北京时间）
  const refMs = Date.UTC(2026, 1, 4, 4, 2, 7, 950) - 8 * 3_600_000;
  const diffMs = Math.abs(lichun.epochMs - refMs);
  assert.ok(diffMs < 2_000, `立春与天文学会参考值相差 ${String(diffMs)} ms`);
});

test('2026 冬至 = 2026-12-22 04:50:14（北京时间），与香港天文学会年历差 <2 秒', () => {
  const dongzhi = findTerm(getSolarTerms(2026), '冬至');
  assert.deepEqual(
    [dongzhi.solar.year, dongzhi.solar.month, dongzhi.solar.day],
    [2026, 12, 22],
  );
  assert.equal(dongzhi.solar.hour, 4);
  assert.equal(dongzhi.solar.minute, 50);
  assert.equal(dongzhi.iso, '2026-12-22T04:50:14+08:00');
  // 香港天文学会《香港天文年历 2026》：2026-12-22 04:50:14.1830（北京时间）
  const refMs = Date.UTC(2026, 11, 22, 4, 50, 14, 183) - 8 * 3_600_000;
  const diffMs = Math.abs(dongzhi.epochMs - refMs);
  assert.ok(diffMs < 2_000, `冬至与天文学会参考值相差 ${String(diffMs)} ms`);
});

test('2027 立春 = 2027-02-04（HKO T2027c.txt 印证）且 2027 有 24 个节气', () => {
  const terms2027 = getSolarTerms(2027);
  assert.equal(terms2027.length, 24);
  const lichun = findTerm(terms2027, '立春');
  assert.deepEqual(
    [lichun.solar.year, lichun.solar.month, lichun.solar.day],
    [2027, 2, 4],
  );
  assert.equal(lichun.solar.hour, 9);
  // 独立实现 astronomy-engine 计算为 2027-02-04 09:46:24（北京时间），差异 <60s
  assert.equal(lichun.solar.minute, 46);
});

test('2026-04-05 是清明节气日；2026-04-06 不是', () => {
  const on = getSolarTermOn({ year: 2026, month: 4, day: 5 });
  assert.equal(on?.name, '清明');
  assert.equal(getSolarTermOn({ year: 2026, month: 4, day: 6 }), undefined);
});

test('上一/下一个节气可跨年', () => {
  const next = getNextSolarTerm({ year: 2026, month: 12, day: 25 });
  assert.equal(next.name, '小寒');
  assert.equal(next.solar.year, 2027);
  assert.equal(next.solar.month, 1);
  assert.equal(next.solar.day, 5);

  const prev = getPreviousSolarTerm({ year: 2027, month: 1, day: 1 });
  assert.equal(prev.name, '冬至');
  assert.equal(prev.solar.year, 2026);
  assert.equal(prev.solar.month, 12);
  assert.equal(prev.solar.day, 22);
});

test('节气间隔合理（14-17 天），且每个节气日都能被 getSolarTermOn 命中', () => {
  const terms = getSolarTerms(2026);
  const dayNumber = (t: SolarTerm): number =>
    Date.UTC(t.solar.year, t.solar.month - 1, t.solar.day) / 86_400_000;
  for (let i = 1; i < terms.length; i += 1) {
    const gap = dayNumber(terms[i] as SolarTerm) - dayNumber(terms[i - 1] as SolarTerm);
    assert.ok(gap >= 14 && gap <= 17, `第 ${String(i)} 个间隔异常：${String(gap)} 天`);
  }
  for (const term of terms) {
    const on = getSolarTermOn(term.solar);
    assert.equal(on?.name, term.name);
  }
});
