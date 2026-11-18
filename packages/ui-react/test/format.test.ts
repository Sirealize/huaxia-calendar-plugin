/**
 * `src/pure/format.ts` 的展示文案测试。
 *
 * 这些断言是「日历看得懂」的底线：初一显示月名、节气日显示节气名、
 * 今日浮标两行文案稳定、历史叙事出处可读。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import type { HistoricalEvent } from '@shishu/core'
import { solarToLunar } from '@shishu/core'

import { buildDayBrief, buildMonthGrid, toDateKey } from '../src/pure/calendar.ts'
import {
  WEEKDAY_SHORT,
  formatCellCaption,
  formatEventAttribution,
  formatEventHeadline,
  formatFestivalLabel,
  formatGanZhiLine,
  formatLunarCell,
  formatPill,
  formatSolarDate,
  formatSolarTermLine,
  formatTermMoment,
  licenseLabel,
  lunarMonthLabel,
} from '../src/pure/format.ts'

test('星期表头是中文单字', () => {
  assert.deepEqual([...WEEKDAY_SHORT], ['日', '一', '二', '三', '四', '五', '六'])
})

test('农历格文案：初一显示月名，其余显示日名', () => {
  // 2026-11-09 = 农历十月初一
  assert.equal(formatLunarCell(solarToLunar({ year: 2026, month: 11, day: 9 })), '十月')
  // 农历十一月初一 → 口语别名「冬月」
  assert.equal(formatLunarCell(solarToLunar({ year: 2026, month: 12, day: 9 })), '冬月')
  // 闰月初一保留「闰」字
  assert.equal(formatLunarCell(solarToLunar({ year: 2023, month: 3, day: 22 })), '闰二月')
  // 非初一显示日名
  assert.equal(formatLunarCell(solarToLunar({ year: 2026, month: 11, day: 18 })), '初十')
  assert.equal(formatLunarCell(solarToLunar({ year: 2026, month: 11, day: 28 })), '二十')
})

test('lunarMonthLabel：闰月与别名优先级', () => {
  assert.equal(lunarMonthLabel(solarToLunar({ year: 2026, month: 2, day: 17 })), '正月')
  assert.equal(lunarMonthLabel(solarToLunar({ year: 2026, month: 12, day: 9 })), '冬月')
  assert.equal(lunarMonthLabel(solarToLunar({ year: 2023, month: 3, day: 22 })), '闰二月')
})

test('formatCellCaption：节气名优先于农历日', () => {
  const grid = buildMonthGrid(2026, 11, { today: { year: 2026, month: 11, day: 18 } })
  const byKey = new Map(grid.days.map((day) => [toDateKey(day.date), day]))

  const termDay = byKey.get('2026-11-22')
  assert.ok(termDay)
  assert.equal(formatCellCaption(termDay), '小雪')

  const firstDay = byKey.get('2026-11-9')
  assert.ok(firstDay)
  assert.equal(formatCellCaption(firstDay), '十月')

  const plainDay = byKey.get('2026-11-18')
  assert.ok(plainDay)
  assert.equal(formatCellCaption(plainDay), '初十')
})

test('公历 / 干支 / 节气时刻格式化', () => {
  assert.equal(formatSolarDate({ year: 2026, month: 11, day: 18 }), '2026年11月18日')
  assert.equal(formatGanZhiLine(buildDayBrief({ year: 2026, month: 11, day: 18 }).ganZhi),
    '丙午年 · 己亥月 · 丙申日')
  assert.equal(formatTermMoment({ solar: { hour: 4, minute: 2 } }), '04:02')
  assert.equal(formatTermMoment({ solar: { hour: 15, minute: 23 } }), '15:23')
  assert.equal(formatTermMoment({ solar: { hour: 0, minute: 5 } }), '00:05')
})

test('节气一行：倒计时与当天交节', () => {
  assert.equal(
    formatSolarTermLine(buildDayBrief({ year: 2026, month: 11, day: 18 })),
    '距「小雪」4 天（11月22日）',
  )
  assert.equal(
    formatSolarTermLine(buildDayBrief({ year: 2026, month: 11, day: 22 })),
    '今日交节 · 小雪 · 15:23',
  )
  // 选中的不是「今天」时不能说「今日交节」
  assert.equal(
    formatSolarTermLine(buildDayBrief({ year: 2026, month: 11, day: 22 }), { isToday: false }),
    '当日交节 · 小雪 · 15:23',
  )
})

test('今日浮标两行文案', () => {
  assert.deepEqual(formatPill(buildDayBrief({ year: 2026, month: 11, day: 18 })), {
    primary: '十月初十',
    secondary: '丙午年 · 丙申日',
  })
  assert.deepEqual(formatPill(buildDayBrief({ year: 2026, month: 11, day: 22 })), {
    primary: '十月十四',
    secondary: '今日小雪',
  })
  // 冬月用别名，不要显示成「十一月十八」这种拗口写法
  assert.equal(formatPill(buildDayBrief({ year: 2026, month: 12, day: 9 })).primary, '冬月初一')
})

test('节日标签：法定节假日带「休」角标', () => {
  const springFestival = buildDayBrief({ year: 2026, month: 2, day: 17 }).festivals[0]
  assert.ok(springFestival)
  assert.equal(formatFestivalLabel(springFestival), '春节 · 休')
  assert.equal(
    formatFestivalLabel({
      id: 'x',
      name: '测试节',
      type: 'solar',
      category: '公历节日',
    }),
    '测试节',
  )
})

test('许可证与叙事出处文案', () => {
  assert.equal(licenseLabel('self-authored'), '原创整理')
  assert.equal(licenseLabel('public-domain'), '公有领域')
  assert.equal(licenseLabel('CC-BY-SA-4.0'), 'CC BY-SA 4.0')
  assert.equal(licenseLabel('unknown'), '来源待核')

  const event: HistoricalEvent = {
    id: 'he-0221-001',
    solar: { month: 2, day: 21 },
    eventYear: -221,
    yearLabel: '公元前 221 年',
    title: '秦统一六国',
    summary: '摘要',
    category: 'political',
    source: '原创整理',
    license: 'self-authored',
  }
  assert.equal(formatEventHeadline(event), '公元前 221 年 · 秦统一六国')
  assert.equal(formatEventAttribution(event), '原创整理')

  const publicDomainEvent: HistoricalEvent = {
    ...event,
    id: 'he-0221-002',
    source: '中国大百科全书',
    license: 'public-domain',
  }
  assert.equal(formatEventAttribution(publicDomainEvent), '中国大百科全书 · 公有领域')
})
