/**
 * 历史叙事轮播纯逻辑测试（0.3.0）。
 *
 * 覆盖验收要求的五块：
 * 1. 条目列表越界回绕（`‹`/`›`、圆点跳转、自动播放）；
 * 2. `1 / 3` 计数文案；
 * 3. category 中文映射；
 * 4. region 标签（中华 / 世界）与 origin 回退；
 * 5. 手动切换 / 换日期 / 暂停后恢复都重置自动播放计时（`timerKey` 自增）。
 *
 * 全部直接测纯函数，不依赖 React / 浏览器；条数 0 / 1 / N 都覆盖。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import type { HistoricalEvent, HistoricalEventCategory } from '@shishu/core'

import {
  CAROUSEL_INTERVAL_MS,
  carouselCountText,
  carouselReducer,
  initialCarouselState,
  stepCarouselIndex,
  wrapCarouselIndex,
} from '../src/pure/carousel.ts'
import { buildDayBrief } from '../src/pure/calendar.ts'
import {
  EVENT_CATEGORY_LABELS,
  EVENT_DATE_KIND_LABELS,
  EVENT_REGION_LABELS,
  carouselSectionTitle,
  eventDateKind,
  eventRegion,
  formatEventCategory,
  formatEventDateKindDetail,
  formatEventDateKindLabel,
  formatEventOrigin,
  formatEventRegion,
  formatMiniDayLine,
} from '../src/pure/format.ts'

/** 造一条最小可用的历史叙事。 */
function makeEvent(overrides: Partial<HistoricalEvent> = {}): HistoricalEvent {
  return {
    id: 'he-1118-001',
    solar: { month: 11, day: 18 },
    eventYear: 960,
    yearLabel: '960 年',
    title: '测试事件',
    summary: '测试摘要',
    category: 'culture',
    source: '原创整理',
    license: 'self-authored',
    ...overrides,
  }
}

// ── 1. 越界回绕 ─────────────────────────────────────────────────────────────

test('轮播索引回绕：负数、超界都环回，0 条恒为 0', () => {
  assert.equal(wrapCarouselIndex(0, 3), 0)
  assert.equal(wrapCarouselIndex(2, 3), 2)
  assert.equal(wrapCarouselIndex(3, 3), 0)
  assert.equal(wrapCarouselIndex(4, 3), 1)
  assert.equal(wrapCarouselIndex(-1, 3), 2)
  assert.equal(wrapCarouselIndex(-4, 3), 2)
  assert.equal(wrapCarouselIndex(0, 1), 0)
  assert.equal(wrapCarouselIndex(9, 5), 4)
  // 0 条：任何索引都收敛到 0，不抛错
  assert.equal(wrapCarouselIndex(7, 0), 0)
  assert.equal(wrapCarouselIndex(-3, 0), 0)
  // 非整数也能收敛（数据源异常时 UI 不崩）
  assert.equal(wrapCarouselIndex(2.9, 3), 2)
})

test('stepCarouselIndex：下一条 / 上一条在首尾回绕', () => {
  // 3 条：0 → 1 → 2 → 0
  assert.equal(stepCarouselIndex(0, 1, 3), 1)
  assert.equal(stepCarouselIndex(1, 1, 3), 2)
  assert.equal(stepCarouselIndex(2, 1, 3), 0)
  // 上一条：0 → 2
  assert.equal(stepCarouselIndex(0, -1, 3), 2)
  assert.equal(stepCarouselIndex(2, -1, 3), 1)
  // 只有 1 条 / 0 条时恒为 0
  assert.equal(stepCarouselIndex(0, 1, 1), 0)
  assert.equal(stepCarouselIndex(0, -1, 1), 0)
  assert.equal(stepCarouselIndex(0, 1, 0), 0)
  // 位移必须是整数
  assert.throws(() => stepCarouselIndex(0, 0.5, 3), RangeError)
})

// ── 2. 计数文案 ─────────────────────────────────────────────────────────────

test('计数文案：`1 / 3`，0 条为空串，1 条为 `1 / 1`', () => {
  assert.equal(carouselCountText(0, 3), '1 / 3')
  assert.equal(carouselCountText(1, 3), '2 / 3')
  assert.equal(carouselCountText(2, 3), '3 / 3')
  // 越界索引先回绕再计数
  assert.equal(carouselCountText(3, 3), '1 / 3')
  assert.equal(carouselCountText(-1, 3), '3 / 3')
  assert.equal(carouselCountText(0, 1), '1 / 1')
  assert.equal(carouselCountText(0, 0), '')
})

// ── 3. category 中文映射 ────────────────────────────────────────────────────

test('category 全部有中文标签，未知分类退化为「其他」', () => {
  assert.deepEqual({ ...EVENT_CATEGORY_LABELS }, {
    political: '政治',
    military: '军事',
    culture: '文化',
    science: '科学',
    technology: '技术',
    economy: '经济',
    society: '社会',
    life: '生活',
    disaster: '灾害',
    sports: '体育',
    other: '其他',
  })
  for (const [category, label] of Object.entries(EVENT_CATEGORY_LABELS)) {
    assert.equal(formatEventCategory(category as HistoricalEventCategory), label)
  }
  assert.equal(formatEventCategory('bogus' as HistoricalEventCategory), '其他')
})

// ── 4. region / origin 标签 ─────────────────────────────────────────────────

test('region 标签：缺省按中华处理，world 显式标世界', () => {
  assert.deepEqual({ ...EVENT_REGION_LABELS }, { china: '中华', world: '世界' })
  // 老数据没有 region 字段 → 中华
  assert.equal(eventRegion(makeEvent()), 'china')
  assert.equal(formatEventRegion(makeEvent()), '中华')
  assert.equal(eventRegion(makeEvent({ region: 'china' })), 'china')
  assert.equal(formatEventRegion(makeEvent({ region: 'china' })), '中华')
  assert.equal(eventRegion(makeEvent({ region: 'world' })), 'world')
  assert.equal(formatEventRegion(makeEvent({ region: 'world' })), '世界')
})

test('origin 标签优先用内容包 origin，缺失时退回中华 / 世界', () => {
  assert.equal(formatEventOrigin(makeEvent({ origin: '中国·北宋' })), '中国·北宋')
  assert.equal(formatEventOrigin(makeEvent({ origin: '欧洲·意大利', region: 'world' })), '欧洲·意大利')
  // origin 缺失 / 空白 → 文明归属标签，标签位不为空
  assert.equal(formatEventOrigin(makeEvent({ region: 'china' })), '中华')
  assert.equal(formatEventOrigin(makeEvent({ region: 'world' })), '世界')
  assert.equal(formatEventOrigin(makeEvent({ origin: '   ' })), '中华')
})

// ── 5. 状态机：切换重置计时 ─────────────────────────────────────────────────

test('轮播初始状态：第 1 条、不暂停、计时版本 0', () => {
  assert.deepEqual(initialCarouselState('2026-11-18'), {
    dateKey: '2026-11-18',
    index: 0,
    paused: false,
    timerKey: 0,
  })
  assert.equal(CAROUSEL_INTERVAL_MS, 8000, '自动轮播间隔必须是 8 秒')
})

test('手动切换（‹ / › / 圆点）回绕并重置计时', () => {
  let state = initialCarouselState('2026-11-18')

  state = carouselReducer(state, { type: 'next', total: 3 })
  assert.equal(state.index, 1)
  assert.equal(state.timerKey, 1, '手动切换必须重置自动播放计时')

  state = carouselReducer(state, { type: 'next', total: 3 })
  state = carouselReducer(state, { type: 'next', total: 3 })
  assert.equal(state.index, 0, '第 3 条再下一条回到第 1 条')
  assert.equal(state.timerKey, 3)

  state = carouselReducer(state, { type: 'prev', total: 3 })
  assert.equal(state.index, 2, '第 1 条再上一条回到最后一条')
  assert.equal(state.timerKey, 4)

  // 圆点直接跳转：越界索引先回绕
  state = carouselReducer(state, { type: 'jump', index: 1, total: 3 })
  assert.equal(state.index, 1)
  assert.equal(state.timerKey, 5)
  state = carouselReducer(state, { type: 'jump', index: 5, total: 3 })
  assert.equal(state.index, 2)
})

test('切换日期：回到第 1 条并重置计时；同一天重复动作是幂等的', () => {
  let state = initialCarouselState('2026-11-18')
  state = carouselReducer(state, { type: 'jump', index: 2, total: 3 })
  assert.equal(state.index, 2)

  const sameDate = carouselReducer(state, { type: 'select-date', dateKey: '2026-11-18' })
  assert.equal(sameDate, state, '同一天不应重建状态')

  const nextDate = carouselReducer(state, { type: 'select-date', dateKey: '2026-11-19' })
  assert.equal(nextDate.dateKey, '2026-11-19')
  assert.equal(nextDate.index, 0, '换日期必须回到第 1 条')
  assert.equal(nextDate.timerKey, state.timerKey + 1, '换日期必须重置自动播放计时')
})

test('悬停 / 聚焦暂停，离开恢复并重新计满 8 秒', () => {
  let state = initialCarouselState('2026-11-18')
  state = carouselReducer(state, { type: 'next', total: 3 })
  const timerBeforePause = state.timerKey

  state = carouselReducer(state, { type: 'pause' })
  assert.equal(state.paused, true)
  assert.equal(state.timerKey, timerBeforePause, '暂停本身不重置计时')

  // 暂停期间自动播放不推进
  const pausedAuto = carouselReducer(state, { type: 'auto', total: 3 })
  assert.equal(pausedAuto, state, '暂停时自动播放必须被忽略')

  state = carouselReducer(state, { type: 'resume' })
  assert.equal(state.paused, false)
  assert.equal(state.timerKey, timerBeforePause + 1, '恢复后重新计满 8 秒')

  // 重复暂停 / 重复恢复都不制造无意义的状态变化
  assert.equal(carouselReducer(state, { type: 'resume' }), state)
  assert.equal(carouselReducer(carouselReducer(state, { type: 'pause' }), { type: 'pause' }).paused, true)
})

test('自动播放：推进一条并重置计时；不足 2 条时不动', () => {
  let state = initialCarouselState('2026-11-18')
  state = carouselReducer(state, { type: 'auto', total: 3 })
  assert.equal(state.index, 1)
  assert.equal(state.timerKey, 1)

  state = carouselReducer(state, { type: 'auto', total: 3 })
  state = carouselReducer(state, { type: 'auto', total: 3 })
  assert.equal(state.index, 0, '自动播放也要回绕')

  // 0 / 1 条：自动播放不产生任何变化
  const single = initialCarouselState('2026-11-18')
  assert.equal(carouselReducer(single, { type: 'auto', total: 1 }), single)
  assert.equal(carouselReducer(single, { type: 'auto', total: 0 }), single)
})

test('状态机不原地修改传入的 state', () => {
  const state = initialCarouselState('2026-11-18')
  const snapshot = { ...state }
  carouselReducer(state, { type: 'next', total: 3 })
  carouselReducer(state, { type: 'pause' })
  carouselReducer(state, { type: 'select-date', dateKey: '2026-12-01' })
  assert.deepEqual(state, snapshot)
})

// ── 6. 左下角信息行多条切换 ─────────────────────────────────────────────────

test('formatMiniDayLine 支持按索引取当天第 N 条叙事（越界回退第一条）', () => {
  const brief = buildDayBrief({ year: 2026, month: 11, day: 18 })
  const events = [
    makeEvent({ id: 'he-1118-001', title: '中华第一条', dateKind: 'exact' }),
    makeEvent({ id: 'he-1118-002', title: '中华第二条', region: 'china', dateKind: 'exact' }),
    makeEvent({ id: 'he-1118-003', title: '世界第三条', region: 'world', origin: '欧洲·意大利', dateKind: 'period' }),
  ]
  const multi = { ...brief, events, event: events[0] }

  assert.ok(formatMiniDayLine(multi).includes('中华第一条'))
  assert.ok(formatMiniDayLine(multi, { eventIndex: 1 }).includes('中华第二条'))
  assert.ok(formatMiniDayLine(multi, { eventIndex: 2 }).includes('世界第三条'))
  // 越界回退第一条，不出现空行
  assert.ok(formatMiniDayLine(multi, { eventIndex: 9 }).includes('中华第一条'))

  // 0 条时依然退化为「农历 · 干支 · 节气倒计时」，不空白
  const empty = { ...brief, events: [], event: undefined }
  assert.ok(formatMiniDayLine(empty).split(' · ').length >= 3)
})

// ── 7. 日期口径 dateKind：exact / period / 缺失字段 ────────────────────────

test('dateKind 标签：exact「历史上的今天」、period「华夏文明坐标」、缺失降级 period', () => {
  assert.deepEqual({ ...EVENT_DATE_KIND_LABELS }, {
    exact: '历史上的今天',
    period: '华夏文明坐标',
  })

  const exact = makeEvent({ dateKind: 'exact', yearLabel: '1863 年' })
  const period = makeEvent({ dateKind: 'period', origin: '中国·北宋', yearLabel: '960 年' })
  const legacy = makeEvent({ origin: undefined, yearLabel: '960 年' })

  assert.equal(eventDateKind(exact), 'exact')
  assert.equal(eventDateKind(period), 'period')
  // 内容数据可能还没补 dateKind：缺失字段必须按 period 处理，不能把文明坐标谎称今天
  assert.equal(eventDateKind(legacy), 'period', '缺失 dateKind 必须降级为 period')

  assert.equal(formatEventDateKindLabel(exact), '历史上的今天')
  assert.equal(formatEventDateKindLabel(period), '华夏文明坐标')
  assert.equal(formatEventDateKindDetail(exact), '历史上的今天')
  assert.equal(formatEventDateKindDetail(period), '华夏文明坐标 · 中国·北宋 · 960 年')
  // origin 缺失时退回文明归属，标签位不为空
  assert.equal(formatEventDateKindDetail(legacy), '华夏文明坐标 · 中华 · 960 年')
})

test('轮播区块标题：混合 / 全 period / 0 条都不误导「今天」', () => {
  const exact = makeEvent({ dateKind: 'exact' })
  const period = makeEvent({ dateKind: 'period' })

  // 0 条：中性标题，不提「今天」
  assert.equal(carouselSectionTitle([]), '古今中外 · 文明坐标')
  // 全部 period：用文明坐标标题，不能出现「今日」
  assert.equal(carouselSectionTitle([period]), '华夏文明坐标 · 古今中外')
  assert.equal(carouselSectionTitle([period, period]), '华夏文明坐标 · 古今中外')
  assert.ok(!carouselSectionTitle([period]).includes('今日'))
  // 有 exact：才可以叫「今日」
  assert.equal(carouselSectionTitle([period, exact]), '今日 · 古今中外')
  assert.equal(carouselSectionTitle([exact]), '今日 · 古今中外')
  // 标题里不再使用笼统的「历史叙事」
  for (const events of [[], [period], [exact]]) {
    assert.ok(!carouselSectionTitle(events).includes('历史叙事'))
  }
})

test('左下角信息行：period 条目行尾标「文明坐标」，exact 不标', () => {
  const brief = buildDayBrief({ year: 2026, month: 11, day: 18 })
  const period = makeEvent({ title: '文明坐标条目', dateKind: 'period' })
  const exact = makeEvent({ title: '今天发生的事', dateKind: 'exact' })
  const asBrief = (events: HistoricalEvent[]) => ({ ...brief, events, event: events[0] })

  const periodLine = formatMiniDayLine(asBrief([period]))
  assert.ok(periodLine.endsWith('文明坐标条目 · 文明坐标'), `实际：${periodLine}`)
  const exactLine = formatMiniDayLine(asBrief([exact]))
  assert.ok(!exactLine.includes('文明坐标'), `exact 条目不加文明坐标标记：${exactLine}`)

  // 多条切换：当前条是 period 时带标记，切到 exact 时不带
  const mixed = asBrief([exact, period])
  assert.ok(!formatMiniDayLine(mixed, { eventIndex: 0 }).includes('文明坐标'))
  assert.ok(formatMiniDayLine(mixed, { eventIndex: 1 }).includes('文明坐标'))
})

test('节气/节日优先的日期，信息行不硬塞「文明坐标」（显示的本来就不是叙事）', () => {
  // 2026-11-22 小雪：信息行尾是节气，与当天叙事口径无关
  const termDay = buildDayBrief({ year: 2026, month: 11, day: 22 })
  const period = makeEvent({ title: '文明坐标条目', dateKind: 'period' })
  const withEvents = { ...termDay, events: [period], event: period }
  const line = formatMiniDayLine(withEvents)
  assert.ok(line.includes('小雪'))
  assert.ok(!line.includes('文明坐标'))
})
