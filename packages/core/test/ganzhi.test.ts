import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getGanZhi, solarToLunar } from '../src/index.ts';

test('2026-02-04 立春当日三种纪年口径的差异（同一天，差一个时刻）', () => {
  // 立春精确时刻 = 2026-02-04 04:02:08（北京时间）
  const before = getGanZhi({ year: 2026, month: 2, day: 4, hour: 0, minute: 0, second: 0 });
  assert.equal(before.yearByLiChun, '乙巳');
  assert.equal(before.yearByLiChunDay, '丙午');
  assert.equal(before.yearByLunarNewYear, '乙巳');
  assert.equal(before.zodiacByLiChun, '蛇');
  assert.equal(before.zodiacByLunarNewYear, '蛇');

  const atMoment = getGanZhi({ year: 2026, month: 2, day: 4, hour: 4, minute: 2, second: 8 });
  assert.equal(atMoment.yearByLiChun, '丙午');
  assert.equal(atMoment.zodiacByLiChun, '马');

  const oneSecondBefore = getGanZhi({ year: 2026, month: 2, day: 4, hour: 4, minute: 2, second: 7 });
  assert.equal(oneSecondBefore.yearByLiChun, '乙巳');
});

test('2026-02-05 ～ 02-16：立春口径已换年、春节口径未换年（差一整年）', () => {
  for (const day of [5, 10, 16]) {
    const gz = getGanZhi({ year: 2026, month: 2, day });
    assert.equal(gz.yearByLiChun, '丙午', `2026-02-${String(day)} 立春口径`);
    assert.equal(gz.yearByLunarNewYear, '乙巳', `2026-02-${String(day)} 春节口径`);
    assert.notEqual(gz.yearByLiChun, gz.yearByLunarNewYear);
    assert.equal(gz.zodiacByLiChun, '马');
    assert.equal(gz.zodiacByLunarNewYear, '蛇');
  }
  // 2026-02-17 春节起两者一致
  const chunjie = getGanZhi({ year: 2026, month: 2, day: 17 });
  assert.equal(chunjie.yearByLiChun, '丙午');
  assert.equal(chunjie.yearByLunarNewYear, '丙午');
});

test('默认口径 = 立春精确时刻（项目推荐口径）', () => {
  const gz = getGanZhi({ year: 2026, month: 2, day: 5 });
  assert.equal(gz.yearPolicy, 'li-chun');
  assert.equal(gz.year, gz.yearByLiChun);
  assert.equal(gz.year, '丙午');
  assert.equal(gz.zodiac, '马');

  const bySpringFestival = getGanZhi({ year: 2026, month: 2, day: 5 }, { yearPolicy: 'lunar-new-year' });
  assert.equal(bySpringFestival.year, '乙巳');
  assert.equal(bySpringFestival.zodiac, '蛇');

  const byLiChunDay = getGanZhi({ year: 2026, month: 2, day: 4 }, { yearPolicy: 'li-chun-day' });
  assert.equal(byLiChunDay.year, '丙午');
});

test('农历展示与干支展示自洽：solarToLunar 用春节口径，getGanZhi 默认用立春口径', () => {
  const lunar = solarToLunar({ year: 2026, month: 2, day: 5 });
  const gz = getGanZhi({ year: 2026, month: 2, day: 5 });
  assert.equal(lunar.lunarYear, 2025); // 仍是农历乙巳年腊月
  assert.equal(lunar.yearGanZhi, '乙巳'); // 春节口径
  assert.equal(gz.year, '丙午'); // 立春口径
  assert.equal(gz.yearByLunarNewYear, '乙巳');
});

test('干支纪日：0 点换日 vs 23 点子时换日', () => {
  const before23 = getGanZhi({ year: 2026, month: 2, day: 17, hour: 22, minute: 59, second: 0 });
  const at23 = getGanZhi({ year: 2026, month: 2, day: 17, hour: 23, minute: 0, second: 0 });
  assert.equal(before23.day, '壬戌');
  assert.equal(before23.dayByZiHour, '壬戌');
  assert.equal(at23.day, '壬戌'); // 0 点换日口径：23 点当天不变
  assert.equal(at23.dayByZiHour, '癸亥'); // 子时换日口径：已进入下一日
});

test('干支纪月：节令日期口径 vs 节令时刻口径在立春当天不同', () => {
  const midnight = getGanZhi({ year: 2026, month: 2, day: 4, hour: 0, minute: 0 });
  assert.equal(midnight.monthByDay, '庚寅');
  assert.equal(midnight.month, '己丑');
  const afterLichun = getGanZhi({ year: 2026, month: 2, day: 4, hour: 4, minute: 3 });
  assert.equal(afterLichun.month, '庚寅');
});

test('时辰干支：0:30 = 庚子，23:00 = 壬子', () => {
  const early = getGanZhi({ year: 2026, month: 2, day: 17, hour: 0, minute: 30 });
  assert.equal(early.hour, '庚子');
  const midnight = getGanZhi({ year: 2026, month: 2, day: 17, hour: 23, minute: 0 });
  assert.equal(midnight.hour, '壬子');
  // 不传 hour 时不返回时辰干支
  assert.equal(getGanZhi({ year: 2026, month: 2, day: 17 }).hour, undefined);
});

test('干支纪日严格 60 甲子循环（120 天逐日校验）', () => {
  const gan = '甲乙丙丁戊己庚辛壬癸';
  const zhi = '子丑寅卯辰巳午未申酉戌亥';
  const startMs = Date.UTC(2026, 0, 1);
  let previous: { gan: string; zhi: string } | undefined;
  for (let i = 0; i < 120; i += 1) {
    const d = new Date(startMs + i * 86_400_000);
    const gz = getGanZhi({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() });
    const dayGan = gz.day.slice(0, 1);
    const dayZhi = gz.day.slice(1, 2);
    assert.equal(dayGan.length, 1, gz.day);
    assert.equal(dayZhi.length, 1, gz.day);
    assert.ok(gan.includes(dayGan), `非法天干 ${gz.day}`);
    assert.ok(zhi.includes(dayZhi), `非法地支 ${gz.day}`);
    if (previous !== undefined) {
      assert.equal(gan.indexOf(dayGan), (gan.indexOf(previous.gan) + 1) % 10, `第 ${String(i)} 天干不连续`);
      assert.equal(zhi.indexOf(dayZhi), (zhi.indexOf(previous.zhi) + 1) % 12, `第 ${String(i)} 地支不连续`);
    }
    previous = { gan: dayGan, zhi: dayZhi };
  }
});
