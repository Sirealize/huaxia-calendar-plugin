/**
 * 左下角月历偏好存储的测试（纯函数 + store，不需要 React / 浏览器）。
 *
 * 覆盖 0.2.0 验收要求里的三块纯逻辑：拖拽位置边界钳制、跨年翻月、
 * 收起/展开与显隐状态（含 localStorage 脏数据防御）。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  MINI_PREFS_DEFAULT,
  MINI_PREFS_KEY,
  OVERLAY_MARGIN,
  clampOverlayRect,
  defaultOverlayRect,
  dragOverlayRect,
  parseMiniPrefs,
  patchMiniPrefs,
  serializeMiniPrefs,
  shiftYearMonth,
  toggleMiniCollapsed,
  toggleMiniVisible,
} from '../src/pure/mini.ts'
import { createMiniCalendarStore, type StorageLike } from '../src/miniStore.ts'
import { buildDayBrief } from '../src/pure/calendar.ts'
import { formatMiniDayLine, formatPill, formatSolarTermLine } from '../src/pure/format.ts'

const VIEWPORT = { width: 1440, height: 900 }
const CARD = { width: 264, height: 332 }

test('默认位置贴左下角：左边距固定，底边距固定', () => {
  const position = defaultOverlayRect(CARD, VIEWPORT)
  assert.equal(position.x, OVERLAY_MARGIN)
  assert.equal(position.y, VIEWPORT.height - CARD.height - OVERLAY_MARGIN)
  assert.equal(position.y, 556)

  // 视口比卡片还矮时也不能把卡片顶到视口外（至少留出顶部把手）。
  const tiny = defaultOverlayRect(CARD, { width: 320, height: 200 })
  assert.equal(tiny.y, OVERLAY_MARGIN)
})

test('拖拽位置钳制：四个方向都留在视口内', () => {
  const start = { x: 100, y: 100, width: CARD.width, height: CARD.height }

  // 往右下拖出视口 → 右下角贴边
  assert.deepEqual(dragOverlayRect(start, { x: 5000, y: 5000 }, VIEWPORT), {
    x: VIEWPORT.width - CARD.width - OVERLAY_MARGIN,
    y: VIEWPORT.height - CARD.height - OVERLAY_MARGIN,
  })

  // 往左上拖出视口 → 左上角贴边
  assert.deepEqual(dragOverlayRect(start, { x: -5000, y: -5000 }, VIEWPORT), {
    x: OVERLAY_MARGIN,
    y: OVERLAY_MARGIN,
  })

  // 视口内的正常位移原样保留（只做平移，不改尺寸）
  assert.deepEqual(dragOverlayRect(start, { x: 40, y: -30 }, VIEWPORT), { x: 140, y: 70 })

  // 视口比卡片还小：贴左上留白，保证标题栏可抓
  const tinyViewport = { width: 200, height: 180 }
  assert.deepEqual(clampOverlayRect({ ...start }, tinyViewport), {
    x: OVERLAY_MARGIN,
    y: OVERLAY_MARGIN,
  })
})

test('clampOverlayRect 对已越界的存量位置也收敛', () => {
  // 窗口从大变小后，旧坐标可能落在视口外
  assert.deepEqual(
    clampOverlayRect({ x: 3000, y: 2000, width: CARD.width, height: CARD.height }, VIEWPORT),
    { x: 1440 - 264 - 12, y: 900 - 332 - 12 },
  )
  // 已经在视口内的坐标不动
  assert.deepEqual(
    clampOverlayRect({ x: 40, y: 50, width: CARD.width, height: CARD.height }, VIEWPORT),
    { x: 40, y: 50 },
  )
})

test('shiftYearMonth：翻月跨年进位/借位，翻年保持月份', () => {
  // 12 月再往后一个月 → 次年 1 月
  assert.deepEqual(shiftYearMonth({ year: 2026, month: 12 }, 1), { year: 2027, month: 1 })
  // 1 月往前一个月 → 上一年 12 月
  assert.deepEqual(shiftYearMonth({ year: 2026, month: 1 }, -1), { year: 2025, month: 12 })
  // 整年翻页（组件里用 ±12 实现上下一年）
  assert.deepEqual(shiftYearMonth({ year: 2026, month: 11 }, 12), { year: 2027, month: 11 })
  assert.deepEqual(shiftYearMonth({ year: 2026, month: 11 }, -12), { year: 2025, month: 11 })
  // 连续翻多个月仍然正确
  assert.deepEqual(shiftYearMonth({ year: 2026, month: 11 }, 14), { year: 2028, month: 1 })
  assert.deepEqual(shiftYearMonth({ year: 2026, month: 11 }, -10), { year: 2026, month: 1 })
  assert.throws(() => shiftYearMonth({ year: 2026, month: 11 }, 0.5), RangeError)
})

test('收起 / 展开 / 显隐状态切换（不可变更新）', () => {
  const collapsed = toggleMiniCollapsed(MINI_PREFS_DEFAULT)
  assert.equal(collapsed.collapsed, true)
  assert.equal(MINI_PREFS_DEFAULT.collapsed, false, '不能原地改默认值')

  assert.equal(toggleMiniCollapsed(collapsed).collapsed, false)

  const hidden = toggleMiniVisible(MINI_PREFS_DEFAULT)
  assert.equal(hidden.visible, false)
  assert.equal(toggleMiniVisible(hidden).visible, true)

  // 打补丁：只改传入字段，其余保持
  const moved = patchMiniPrefs(MINI_PREFS_DEFAULT, { position: { x: 30, y: 40 } })
  assert.deepEqual(moved.position, { x: 30, y: 40 })
  assert.equal(moved.collapsed, false)
  assert.equal(moved.visible, true)
})

test('偏好序列化 / 反序列化：位置可空、脏数据退默认值', () => {
  assert.deepEqual(parseMiniPrefs(null), {
    position: null,
    collapsed: false,
    visible: true,
  })

  const roundTrip = parseMiniPrefs(serializeMiniPrefs({ position: { x: 12, y: 34 }, collapsed: true, visible: false }))
  assert.deepEqual(roundTrip, { position: { x: 12, y: 34 }, collapsed: true, visible: false })

  // 没有拖拽过就不写 position 字段
  assert.equal(JSON.parse(serializeMiniPrefs({ position: null, collapsed: false, visible: true }))['position'], undefined)

  // 坏 JSON / 错类型 / 非有限数：全部退默认值，不抛错
  assert.deepEqual(parseMiniPrefs('not json'), { position: null, collapsed: false, visible: true })
  assert.deepEqual(parseMiniPrefs('null'), { position: null, collapsed: false, visible: true })
  assert.deepEqual(parseMiniPrefs('{"position":{"x":"a","y":2}}'), {
    position: null,
    collapsed: false,
    visible: true,
  })
  assert.deepEqual(parseMiniPrefs('{"position":{"x":1,"y":null}}'), {
    position: null,
    collapsed: false,
    visible: true,
  })
  assert.deepEqual(parseMiniPrefs('{"collapsed":"yes","visible":false}'), {
    position: null,
    collapsed: false,
    visible: false,
  })
})

test('store：写入落盘 + 通知订阅者，无变化不重复通知', () => {
  const memory = new Map<string, string>()
  const storage: StorageLike = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => {
      memory.set(key, value)
    },
    removeItem: (key) => {
      memory.delete(key)
    },
  }

  const store = createMiniCalendarStore({ storage })
  assert.deepEqual(store.get(), { position: null, collapsed: false, visible: true })

  let notified = 0
  const unsubscribe = store.subscribe(() => {
    notified += 1
  })

  store.set({ collapsed: true })
  assert.equal(store.get().collapsed, true)
  assert.equal(notified, 1)
  assert.equal(
    memory.get(MINI_PREFS_KEY),
    '{"collapsed":true,"visible":true}',
    '收起状态必须写进 localStorage',
  )

  // 同样的值再写一次：不通知、不重复渲染
  store.set({ collapsed: true })
  assert.equal(notified, 1)

  // 拖拽位置也要持久化
  store.set({ position: { x: 88, y: 66 } })
  assert.equal(notified, 2)
  assert.deepEqual(JSON.parse(memory.get(MINI_PREFS_KEY) ?? '{}')['position'], { x: 88, y: 66 })

  unsubscribe()
  store.set({ visible: false })
  assert.equal(notified, 2, '退订后不再收到通知')
})

test('store：没有 localStorage 时退化为内存，不抛错', () => {
  const store = createMiniCalendarStore({ storage: null })
  store.set({ collapsed: true })
  assert.equal(store.get().collapsed, true)
  assert.equal(store.get().visible, true)
})

test('store：从 localStorage 恢复上次的收起与位置（刷新后保持）', () => {
  const store = createMiniCalendarStore({
    storage: {
      getItem: () => '{"position":{"x":41,"y":52},"collapsed":true,"visible":true}',
      setItem: () => {},
      removeItem: () => {},
    },
  })
  assert.deepEqual(store.get().position, { x: 41, y: 52 })
  assert.equal(store.get().collapsed, true)
})

// ── 选中日期信息（点某天后卡片底部那一行） ─────────────────────────────────

test('选中日信息：普通日给农历 + 干支 + 历史叙事标题', () => {
  // 2026-11-18：无节气无节日，内容包里有一条历史叙事
  const line = formatMiniDayLine(buildDayBrief({ year: 2026, month: 11, day: 18 }))
  assert.equal(line, '十月初十 · 丙申日 · 北美铁路启用标准时间')
  assert.ok(line.includes('十月初十'), '必须能看懂农历')
  assert.ok(line.includes('丙申日'), '必须有干支日')
})

test('选中日信息：节气日以节气优先（今天写「今日交节」，非今天写「当日交节」）', () => {
  const termDay = buildDayBrief({ year: 2026, month: 11, day: 22 })
  assert.equal(formatMiniDayLine(termDay), '十月十四 · 庚子日 · 今日交节 · 小雪')
  assert.equal(
    formatMiniDayLine(termDay, { isToday: false }),
    '十月十四 · 庚子日 · 当日交节 · 小雪',
  )
})

test('选中日信息：节日日显示节日名（内容包无条目时也不空白）', () => {
  // 2026-02-17 春节：无节气、内容包无历史叙事，只有节日
  const springFestival = buildDayBrief({ year: 2026, month: 2, day: 17 })
  assert.equal(springFestival.event, undefined, '这个日期内容包确实没有条目')
  const line = formatMiniDayLine(springFestival)
  assert.ok(line.includes('正月初一'))
  assert.ok(line.includes('春节'))
})

test('选中日信息：没有任何内容时退化到节气倒计时，不出现空行', () => {
  // 2026-02-28：无节气、无节日、内容包无条目
  const bare = buildDayBrief({ year: 2026, month: 2, day: 28 })
  assert.equal(bare.solarTerm, undefined)
  assert.equal(bare.event, undefined)
  assert.equal(bare.festivals.length, 0)

  const line = formatMiniDayLine(bare)
  // 仍然有「农历月日 · 干支日 · ...」三段，且末段是下一个节气的倒计时
  assert.equal(line.split(' · ').length >= 3, true)
  assert.ok(line.includes('正月'))
  assert.ok(line.includes(`${bare.ganZhi.day}日`))
  assert.ok(line.endsWith(formatSolarTermLine(bare)))
})

test('收起态小条文案：今天农历日 + 今日节气（无节气报干支）', () => {
  assert.deepEqual(formatPill(buildDayBrief({ year: 2026, month: 11, day: 22 })), {
    primary: '十月十四',
    secondary: '今日小雪',
  })
  assert.deepEqual(formatPill(buildDayBrief({ year: 2026, month: 11, day: 18 })), {
    primary: '十月初十',
    secondary: '丙午年 · 丙申日',
  })
})
