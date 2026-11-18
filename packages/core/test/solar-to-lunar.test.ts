import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solarToLunar } from '../src/index.ts';

test('2026 春节 = 2026-02-17，农历二〇二六年正月初一，丙午马', () => {
  const r = solarToLunar({ year: 2026, month: 2, day: 17 });
  assert.equal(r.lunarYear, 2026);
  assert.equal(r.lunarMonth, 1);
  assert.equal(r.lunarDay, 1);
  assert.equal(r.isLeapMonth, false);
  assert.equal(r.lunarYearName, '二〇二六');
  assert.equal(r.lunarMonthName, '正月');
  assert.equal(r.lunarDayName, '初一');
  assert.equal(r.lunarDateName, '二〇二六年正月初一');
  assert.equal(r.zodiac, '马');
  assert.equal(r.yearGanZhi, '丙午');
  assert.equal(r.weekday, 2);
  assert.equal(r.weekdayName, '星期二');
  assert.equal(r.dayOfYear, 48);
});

test('2027 春节 = 2027-02-06，丁未羊年正月初一', () => {
  const r = solarToLunar({ year: 2027, month: 2, day: 6 });
  assert.equal(r.lunarYear, 2027);
  assert.equal(r.lunarMonth, 1);
  assert.equal(r.lunarDay, 1);
  assert.equal(r.yearGanZhi, '丁未');
  assert.equal(r.zodiac, '羊');
});

test('2026-02-16 是除夕（腊月廿九，不是三十）', () => {
  const r = solarToLunar({ year: 2026, month: 2, day: 16 });
  assert.equal(r.lunarYear, 2025);
  assert.equal(r.lunarMonth, 12);
  assert.equal(r.lunarDay, 29);
  assert.equal(r.lunarMonthName, '十二月');
  assert.equal(r.lunarMonthAlias, '腊月');
  assert.equal(r.lunarDayName, '廿九');
});

test('闰月：2020 闰四月初一 = 2020-05-23', () => {
  const r = solarToLunar({ year: 2020, month: 5, day: 23 });
  assert.equal(r.lunarYear, 2020);
  assert.equal(r.lunarMonth, 4);
  assert.equal(r.lunarDay, 1);
  assert.equal(r.isLeapMonth, true);
  assert.equal(r.lunarMonthName, '闰四月');
});

test('闰月：2023 闰二月初一 = 2023-03-22', () => {
  const r = solarToLunar({ year: 2023, month: 3, day: 22 });
  assert.equal(r.lunarYear, 2023);
  assert.equal(r.lunarMonth, 2);
  assert.equal(r.lunarDay, 1);
  assert.equal(r.isLeapMonth, true);
  assert.equal(r.lunarMonthName, '闰二月');
});

test('闰月：2025 闰六月初一 = 2025-07-25', () => {
  const r = solarToLunar({ year: 2025, month: 7, day: 25 });
  assert.equal(r.lunarYear, 2025);
  assert.equal(r.lunarMonth, 6);
  assert.equal(r.lunarDay, 1);
  assert.equal(r.isLeapMonth, true);
  assert.equal(r.lunarMonthName, '闰六月');
});

test('2033 闰十一月（著名的 2033 年问题）: 2033-12-22 = 闰十一月初一', () => {
  // HKO 官历 T2033c.txt：2033年12月21日=三十，12月22日=閏十一月
  const r = solarToLunar({ year: 2033, month: 12, day: 22 });
  assert.equal(r.lunarYear, 2033);
  assert.equal(r.lunarMonth, 11);
  assert.equal(r.lunarDay, 1);
  assert.equal(r.isLeapMonth, true);
  assert.equal(r.lunarMonthName, '闰十一月');
});

test('2028 闰五月初五 = 2028-06-27（HKO 印证）', () => {
  const r = solarToLunar({ year: 2028, month: 6, day: 27 });
  assert.equal(r.lunarMonth, 5);
  assert.equal(r.lunarDay, 5);
  assert.equal(r.isLeapMonth, true);
});

test('支持范围下界：1900-01-31 = 农历正月初一', () => {
  const r = solarToLunar({ year: 1900, month: 1, day: 31 });
  assert.equal(r.lunarYear, 1900);
  assert.equal(r.lunarMonth, 1);
  assert.equal(r.lunarDay, 1);
});

test('支持范围上界：2100-12-31 = 十二月初一（HKO T2100c.txt 印证）', () => {
  const r = solarToLunar({ year: 2100, month: 12, day: 31 });
  assert.equal(r.lunarYear, 2100);
  assert.equal(r.lunarMonth, 12);
  assert.equal(r.lunarDay, 1);
});

test('Date 入参按宿主本地字段解释（与 getFullYear 等一致）', () => {
  const localNoon = new Date(2026, 1, 17, 12, 0, 0);
  const r = solarToLunar(localNoon);
  assert.equal(r.solar.year, 2026);
  assert.equal(r.solar.month, 2);
  assert.equal(r.solar.day, 17);
  assert.equal(r.lunarDateName, '二〇二六年正月初一');
});

test('非法日期抛错，不静默进位', () => {
  assert.throws(() => solarToLunar({ year: 2026, month: 2, day: 30 }), /不存在的公历日期/);
  assert.throws(() => solarToLunar({ year: 2026, month: 13, day: 1 }), /month/);
  assert.throws(() => solarToLunar(new Date(Number.NaN)), /无效 Date/);
});
