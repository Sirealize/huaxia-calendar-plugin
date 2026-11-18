import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getFestivals,
  getGanZhi,
  getSolarTerms,
  getSolarTermOn,
  solarToLunar,
  SOLAR_TERM_NAMES,
  type LunarDateInfo,
  type SolarTerm,
} from '../src/index.ts';

const DAY_MS = 86_400_000;

/**
 * 模糊测试：连续 10 年（2026-01-01 → 2035-12-31，共 3652 天）逐日遍历。
 *
 * 断言：
 * 1. 任何一天都不抛异常、不返回空值/NaN；
 * 2. 农历月日严格连续（无跳变、无断档、闰月只出现在月首）；
 * 3. 干支纪日严格 60 甲子递增；
 * 4. 每年 24 节气齐全、有序、日期与 getSolarTermOn 一致；
 * 5. 每个农历年恰好 1 个春节；节日 id 单日不重复。
 */
test('10 年逐日遍历（3652 天）无异常、农历连续、节气齐全', () => {
  const years = new Set<number>();
  let totalDays = 0;
  let dayCountByYear = new Map<number, number>();

  let previous: LunarDateInfo | undefined;
  let previousDayGanZhi: string | undefined;
  const chunjieYears = new Map<number, number>();

  const startMs = Date.UTC(2026, 0, 1);
  const endMs = Date.UTC(2035, 11, 31);

  for (let ms = startMs; ms <= endMs; ms += DAY_MS) {
    const date = new Date(ms);
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth() + 1;
    const d = date.getUTCDate();
    years.add(y);
    totalDays += 1;
    dayCountByYear.set(y, (dayCountByYear.get(y) ?? 0) + 1);

    const lunar = solarToLunar({ year: y, month: m, day: d });

    // ---- 1. 字段合法、无空值 ----
    assert.ok(Number.isInteger(lunar.lunarYear) && lunar.lunarYear > 1900, `${y}-${m}-${d} lunarYear`);
    assert.ok(lunar.lunarMonth >= 1 && lunar.lunarMonth <= 12, `${y}-${m}-${d} lunarMonth=${lunar.lunarMonth}`);
    assert.ok(lunar.lunarDay >= 1 && lunar.lunarDay <= 30, `${y}-${m}-${d} lunarDay=${lunar.lunarDay}`);
    assert.ok(typeof lunar.lunarDateName === 'string' && lunar.lunarDateName.length > 3);
    assert.ok(lunar.weekday === new Date(ms).getUTCDay());
    assert.ok(lunar.dayOfYear >= 1 && lunar.dayOfYear <= 366);
    assert.ok(!Number.isNaN(lunar.lunarMonth), `${y}-${m}-${d} lunarMonth NaN`);

    // ---- 2. 农历连续性 ----
    if (previous !== undefined) {
      const sameMonth =
        lunar.lunarYear === previous.lunarYear &&
        lunar.lunarMonth === previous.lunarMonth &&
        lunar.isLeapMonth === previous.isLeapMonth;
      if (sameMonth) {
        assert.equal(
          lunar.lunarDay,
          previous.lunarDay + 1,
          `${y}-${m}-${d} 月内日序跳变：${previous.lunarDateName} → ${lunar.lunarDateName}`,
        );
      } else {
        assert.equal(
          lunar.lunarDay,
          1,
          `${y}-${m}-${d} 进入新月但不是初一：${previous.lunarDateName} → ${lunar.lunarDateName}`,
        );
        if (previous.isLeapMonth) {
          // 闰月结束 → 进入下一个普通月
          if (previous.lunarMonth === 12) {
            assert.equal(lunar.lunarYear, previous.lunarYear + 1);
            assert.equal(lunar.lunarMonth, 1);
          } else {
            assert.equal(lunar.lunarYear, previous.lunarYear);
            assert.equal(lunar.lunarMonth, previous.lunarMonth + 1);
          }
          assert.equal(lunar.isLeapMonth, false);
        } else if (previous.lunarMonth === 12) {
          // 腊月结束 → 下一农历年正月
          assert.equal(lunar.lunarYear, previous.lunarYear + 1);
          assert.equal(lunar.lunarMonth, 1);
          assert.equal(lunar.isLeapMonth, false);
        } else {
          // 普通月结束 → 可能是闰同名月，也可能是下个月
          assert.equal(lunar.lunarYear, previous.lunarYear);
          if (lunar.isLeapMonth) {
            assert.equal(lunar.lunarMonth, previous.lunarMonth, '闰月必须紧跟同名普通月');
          } else {
            assert.equal(lunar.lunarMonth, previous.lunarMonth + 1);
          }
        }
      }
    }

    // ---- 3. 干支纪日连续 ----
    const gz = getGanZhi({ year: y, month: m, day: d });
    if (previousDayGanZhi !== undefined) {
      const gan = '甲乙丙丁戊己庚辛壬癸';
      const zhi = '子丑寅卯辰巳午未申酉戌亥';
      assert.equal(
        gan.indexOf(gz.day.slice(0, 1)),
        (gan.indexOf(previousDayGanZhi.slice(0, 1)) + 1) % 10,
        `${y}-${m}-${d} 天干不连续`,
      );
      assert.equal(
        zhi.indexOf(gz.day.slice(1, 2)),
        (zhi.indexOf(previousDayGanZhi.slice(1, 2)) + 1) % 12,
        `${y}-${m}-${d} 地支不连续`,
      );
    }
    previousDayGanZhi = gz.day;

    // ---- 4. 节日：单日 id 唯一；春节每个农历年 1 次 ----
    const festivals = getFestivals({ year: y, month: m, day: d });
    const festivalIds = festivals.map((f) => f.id);
    assert.equal(new Set(festivalIds).size, festivalIds.length, `${y}-${m}-${d} 节日 id 重复`);
    if (festivalIds.includes('chun-jie')) {
      assert.equal(lunar.lunarMonth, 1);
      assert.equal(lunar.lunarDay, 1);
      chunjieYears.set(lunar.lunarYear, (chunjieYears.get(lunar.lunarYear) ?? 0) + 1);
    }

    previous = lunar;
  }

  // ---- 5. 年度统计 ----
  assert.equal(totalDays, 3652);
  assert.deepEqual([...years], [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035]);
  for (let y = 2026; y <= 2035; y += 1) {
    const expectedDays = new Date(Date.UTC(y, 1, 29)).getUTCMonth() === 1 ? 366 : 365;
    assert.equal(dayCountByYear.get(y), expectedDays, `${String(y)} 年天数`);
  }
  assert.equal(chunjieYears.size, 10, `10 个农历年都应有一个春节，实际 ${String(chunjieYears.size)}`);
  for (const [year, count] of chunjieYears) {
    assert.equal(count, 1, `${String(year)} 年春节出现 ${String(count)} 次`);
  }
});

test('10 年节气：每年 24 个、顺序正确、日期与 getSolarTermOn 一致、间隔 14-17 天', () => {
  for (let year = 2026; year <= 2035; year += 1) {
    const terms = getSolarTerms(year);
    assert.equal(terms.length, 24, `${String(year)} 年节气数量`);
    assert.deepEqual(
      terms.map((t) => t.name),
      [...SOLAR_TERM_NAMES],
      `${String(year)} 年节气顺序`,
    );
    const dayNumber = (t: SolarTerm): number =>
      Date.UTC(t.solar.year, t.solar.month - 1, t.solar.day) / DAY_MS;
    for (let i = 1; i < terms.length; i += 1) {
      const gap = dayNumber(terms[i] as SolarTerm) - dayNumber(terms[i - 1] as SolarTerm);
      assert.ok(gap >= 14 && gap <= 17, `${String(year)} 年第 ${String(i)} 个节气间隔 ${String(gap)} 天`);
    }
    for (const term of terms) {
      const on = getSolarTermOn(term.solar);
      assert.equal(on?.name, term.name, `${String(year)} 年 ${term.name} 日期与 getSolarTermOn 不一致`);
    }
  }
});
