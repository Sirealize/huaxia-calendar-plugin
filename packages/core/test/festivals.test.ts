import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getFestivals, type FestivalInfo } from '../src/index.ts';

function ids(festivals: FestivalInfo[]): string[] {
  return festivals.map((f) => f.id);
}

function expectFestival(date: { year: number; month: number; day: number }, id: string, name: string): void {
  const list = getFestivals(date);
  const hit = list.find((f) => f.id === id);
  assert.ok(hit, `${String(date.month)}-${String(date.day)} 未命中 ${name}；实际 ${ids(list).join(',')}`);
  assert.equal(hit.name, name);
}

test('2026 春节 / 除夕 / 元宵', () => {
  expectFestival({ year: 2026, month: 2, day: 17 }, 'chun-jie', '春节');
  expectFestival({ year: 2026, month: 2, day: 16 }, 'chu-xi', '除夕');
  expectFestival({ year: 2026, month: 3, day: 3 }, 'yuan-xiao-jie', '元宵节');
  // 除夕是法定节假日（2025 年起）
  const chuxi = getFestivals({ year: 2026, month: 2, day: 16 }).find((f) => f.id === 'chu-xi');
  assert.equal(chuxi?.isStatutoryHoliday, true);
});

test('2027 春节 = 2027-02-06，除夕 = 2027-02-05', () => {
  expectFestival({ year: 2027, month: 2, day: 6 }, 'chun-jie', '春节');
  expectFestival({ year: 2027, month: 2, day: 5 }, 'chu-xi', '除夕');
});

test('传统节日：端午/七夕/中秋/重阳/腊八', () => {
  expectFestival({ year: 2026, month: 6, day: 19 }, 'duan-wu-jie', '端午节');
  expectFestival({ year: 2026, month: 8, day: 19 }, 'qi-xi-jie', '七夕节');
  expectFestival({ year: 2026, month: 9, day: 25 }, 'zhong-qiu-jie', '中秋节');
  expectFestival({ year: 2026, month: 10, day: 18 }, 'chong-yang-jie', '重阳节');
  // 腊八 = 农历十二月初八 = 2027-01-15（2026-12-08 是农历十月三十）
  expectFestival({ year: 2027, month: 1, day: 15 }, 'la-ba-jie', '腊八节');
});

test('节气类节日：2026-04-05 清明、2026-12-22 冬至', () => {
  expectFestival({ year: 2026, month: 4, day: 5 }, 'qing-ming', '清明节');
  expectFestival({ year: 2026, month: 12, day: 22 }, 'dong-zhi', '冬至');
});

test('公历节日：元旦/劳动节/国庆节', () => {
  expectFestival({ year: 2026, month: 1, day: 1 }, 'yuan-dan', '元旦');
  expectFestival({ year: 2026, month: 5, day: 1 }, 'lao-dong-jie', '劳动节');
  expectFestival({ year: 2026, month: 10, day: 1 }, 'guo-qing-jie', '国庆节');
});

test('闰月不重复过节：2028-06-27 是闰五月初五，不算端午节', () => {
  const leap = getFestivals({ year: 2028, month: 6, day: 27 });
  assert.ok(!ids(leap).includes('duan-wu-jie'), `闰五月初五不应命中端午节：${ids(leap).join(',')}`);
  // 真正的端午节是五月初五 = 2028-05-28
  expectFestival({ year: 2028, month: 5, day: 28 }, 'duan-wu-jie', '端午节');
});

test('同一天多个节日并存（2026-04-05 清明，若与公历节日重叠也应全部返回）', () => {
  const list = getFestivals({ year: 2026, month: 4, day: 5 });
  assert.ok(list.length >= 1);
  // 类型/分类字段完整
  for (const festival of list) {
    assert.ok(typeof festival.id === 'string' && festival.id.length > 0);
    assert.ok(typeof festival.name === 'string' && festival.name.length > 0);
    assert.ok(['solar', 'lunar', 'solar-term', 'custom'].includes(festival.type));
    assert.ok(typeof festival.category === 'string' && festival.category.length > 0);
  }
});

test('普通日期返回空数组', () => {
  assert.deepEqual(getFestivals({ year: 2026, month: 3, day: 5 }), []);
});
