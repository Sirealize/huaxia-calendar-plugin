/**
 * `src/pure/calendar.ts` 的纯逻辑测试（node --test，无需构建、无需浏览器）。
 *
 * 断言里的农历/节气值都是 2026 年的已知事实（并与 `@shishu/core` 的 README 示例
 * 对齐），所以这些测试同时也在守住「UI 层没有把算法值写错」。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { getEventForDate } from '@shishu/content-l1'

import {
  addDays,
  buildDayBrief,
  buildMonthGrid,
  buildMonthHeader,
  dayDiff,
  daysInMonth,
  isSameDate,
  shiftMonth,
  toDateKey,
  todayDate,
} from '../src/pure/calendar.ts'

test('daysInMonth 处理闰年二月', () => {
  assert.equal(daysInMonth(2026, 2), 28)
  assert.equal(daysInMonth(2024, 2), 29)
  assert.equal(daysInMonth(2026, 11), 30)
  assert.equal(daysInMonth(2026, 12), 31)
  assert.throws(() => daysInMonth(2026, 13), RangeError)
  assert.throws(() => daysInMonth(2026, 0), RangeError)
})

test('addDays / dayDiff 跨月跨年', () => {
  assert.deepEqual(addDays({ year: 2026, month: 12, day: 31 }, 1), {
    year: 2027,
    month: 1,
    day: 1,
  })
  assert.deepEqual(addDays({ year: 2026, month: 1, day: 1 }, -1), {
    year: 2025,
    month: 12,
    day: 31,
  })
  assert.equal(dayDiff({ year: 2026, month: 11, day: 18 }, { year: 2026, month: 11, day: 22 }), 4)
  assert.equal(dayDiff({ year: 2026, month: 11, day: 30 }, { year: 2026, month: 12, day: 1 }), 1)
  assert.equal(dayDiff({ year: 2026, month: 11, day: 18 }, { year: 2026, month: 11, day: 18 }), 0)
})

test('shiftMonth 跨年进位与借位', () => {
  assert.deepEqual(shiftMonth(2026, 1, -1), { year: 2025, month: 12 })
  assert.deepEqual(shiftMonth(2026, 12, 1), { year: 2027, month: 1 })
  assert.deepEqual(shiftMonth(2026, 6, 0), { year: 2026, month: 6 })
  assert.deepEqual(shiftMonth(2026, 3, -14), { year: 2025, month: 1 })
  assert.deepEqual(shiftMonth(2026, 3, 14), { year: 2027, month: 5 })
})

test('toDateKey / isSameDate / todayDate', () => {
  assert.equal(toDateKey({ year: 2026, month: 1, day: 9 }), '2026-1-9')
  assert.equal(isSameDate({ year: 2026, month: 1, day: 9 }, { year: 2026, month: 1, day: 9 }), true)
  assert.equal(isSameDate({ year: 2026, month: 1, day: 9 }, { year: 2026, month: 1, day: 10 }), false)
  assert.deepEqual(todayDate(new Date(2026, 10, 18, 9, 30)), { year: 2026, month: 11, day: 18 })
})

test('buildMonthGrid：2026 年 11 月（周首周日，5 行）', () => {
  const grid = buildMonthGrid(2026, 11, { today: { year: 2026, month: 11, day: 18 } })

  // 2026-11-01 是周日，共 30 天 → ceil(30/7) = 5 行
  assert.equal(grid.days.length, 35)
  assert.equal(grid.weeks.length, 5)
  assert.ok(grid.weeks.every((week) => week.length === 7))

  // 首格是 11-01，末格补到 12-05
  assert.deepEqual(grid.days[0]?.date, { year: 2026, month: 11, day: 1 })
  assert.deepEqual(grid.days[34]?.date, { year: 2026, month: 12, day: 5 })
  assert.equal(grid.days.filter((day) => day.inMonth).length, 30)
  assert.equal(grid.days.filter((day) => day.inMonth === false).length, 5)

  // 每格都有农历数据
  for (const day of grid.days) {
    assert.ok(day.lunar.lunarDayName.length > 0)
    assert.ok(day.lunar.lunarDateName.startsWith('二〇二六'))
    assert.equal(day.weekday, day.lunar.weekday)
  }

  // 今天唯一且被标出
  const todays = grid.days.filter((day) => day.isToday)
  assert.equal(todays.length, 1)
  assert.deepEqual(todays[0]?.date, { year: 2026, month: 11, day: 18 })

  // 周末弱化标记
  assert.equal(grid.days[0]?.isWeekend, true) // 11-01 周日
  assert.equal(grid.days[1]?.isWeekend, false) // 11-02 周一
  assert.equal(grid.days[6]?.isWeekend, true) // 11-07 周六
})

test('buildMonthGrid：2 月恰好 4 行，8 月需要 6 行', () => {
  const feb = buildMonthGrid(2026, 2, { today: { year: 2026, month: 2, day: 17 } })
  assert.equal(feb.days.length, 28) // 2026-02-01 周日 + 28 天 → 4 行
  assert.equal(feb.weeks.length, 4)
  assert.ok(feb.days.every((day) => day.inMonth))

  const aug = buildMonthGrid(2026, 8, { today: { year: 2026, month: 8, day: 1 } })
  assert.equal(aug.days.length, 42) // 2026-08-01 周六 + 31 天 → 6 行
  assert.equal(aug.weeks.length, 6)
  assert.deepEqual(aug.days[0]?.date, { year: 2026, month: 7, day: 26 })
})

test('buildMonthGrid：节气格与农历初一格', () => {
  const grid = buildMonthGrid(2026, 11, { today: { year: 2026, month: 11, day: 18 } })
  const byKey = new Map(grid.days.map((day) => [toDateKey(day.date), day]))

  // 2026-11-22 小雪
  assert.equal(byKey.get('2026-11-22')?.solarTerm, '小雪')
  // 2026-11-07 立冬
  assert.equal(byKey.get('2026-11-7')?.solarTerm, '立冬')
  // 2026-11-09 是农历十月初一
  assert.equal(byKey.get('2026-11-9')?.lunar.lunarDay, 1)
  assert.equal(byKey.get('2026-11-9')?.lunar.lunarMonthName, '十月')
  // 补位的下月日期也要有节气（12-07 大雪在网格外，这里只验证有数据不塌）
  for (const day of grid.days) {
    assert.ok(Array.isArray(day.festivals))
  }
})

test('buildMonthHeader 用月中取农历年/干支年，月初跨年不歧义', () => {
  assert.deepEqual(buildMonthHeader(2026, 11), {
    solarTitle: '2026年11月',
    lunarTitle: '农历二〇二六年十月 · 丙午马年',
  })
  // 2026-01-15 仍在乙巳年（春节 2026-02-17 才换年），表头必须显示上一农历年
  assert.deepEqual(buildMonthHeader(2026, 1), {
    solarTitle: '2026年1月',
    lunarTitle: '农历二〇二五年十一月 · 乙巳蛇年',
  })
})

test('buildDayBrief：完整取数', () => {
  const brief = buildDayBrief({ year: 2026, month: 11, day: 18 })

  assert.deepEqual(brief.date, { year: 2026, month: 11, day: 18 })
  assert.equal(brief.weekdayName, '星期三')
  assert.equal(brief.lunar.lunarDateName, '二〇二六年十月初十')
  assert.equal(brief.lunar.lunarDayName, '初十')

  assert.equal(brief.ganZhi.year, '丙午')
  assert.equal(brief.ganZhi.month, '己亥')
  assert.equal(brief.ganZhi.day, '丙申')
  assert.equal(brief.lunar.zodiac, '马')

  // 11-18 不是节气日，下一个节气是小雪
  assert.equal(brief.solarTerm, undefined)
  assert.equal(brief.nextSolarTerm.name, '小雪')

  // 历史叙事：有就带标题，没有就是 undefined（UI 负责降级）
  if (brief.event !== undefined) assert.equal(typeof brief.event.title, 'string')
})

test('buildDayBrief：节气日 + 节日', () => {
  const termDay = buildDayBrief({ year: 2026, month: 11, day: 22 })
  assert.equal(termDay.solarTerm?.name, '小雪')
  assert.equal(termDay.solarTerm?.solar.hour, 15)

  const springFestival = buildDayBrief({ year: 2026, month: 2, day: 17 })
  assert.ok(springFestival.festivals.some((festival) => festival.name === '春节'))
  assert.equal(springFestival.lunar.lunarDateName, '二〇二六年正月初一')
})

test('内容包无条目时返回 undefined（UI 必须优雅降级）', () => {
  // 2 月 30 日永远不可能出现在按公历月日归档的内容包里
  assert.equal(getEventForDate(2, 30), undefined)

  // buildDayBrief 始终给出 event 字段（可能为 undefined），不会因为缺条目抛错
  const brief = buildDayBrief({ year: 2026, month: 2, day: 28 })
  assert.equal('event' in brief, true)
  if (brief.event !== undefined) assert.equal(typeof brief.event.title, 'string')
})
