/**
 * 离线契约校验：不启动 GUI、不开浏览器，验证构建产物「装得进、点得到、是真日历」。
 *
 * 它做四类断言：
 *   1. 安装契约：`package.json.dsh` 清单 + `cordis.patch.yml` + `engines.dsh` 精确版本；
 *   2. bundle 契约：通过 `window.__ModuleLoader__` 接缝，id 与包名一致，平台模块走 external、
 *      `@shishu/*` 被真正打进 bundle（运行时没有宿主模块表兜底）；
 *   3. 席位契约：三个席位（sidebar.panellist / main / shell.overlay）按预期元数据注册；
 *   4. 真日历逻辑：用 React 的轻量替身真的调用三个组件，检查渲染出 7×N 月网格、
 *      今天的农历日与 core 的实算一致、当月节气名出现在格子里、历史叙事/降级文案正确。
 *
 * 用法：`npm run verify`（需先 `npm run build`）。
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { getGanZhi, getSolarTerms, SOLAR_TERM_NAMES, solarToLunar } from '@shishu/core'
import { getEventForDate } from '@shishu/content-l1'

const here = (path) => new URL(path, import.meta.url)
const fail = (message) => {
  throw new Error(`verify failed: ${message}`)
}
const assert = (condition, message) => {
  if (!condition) fail(message)
}

// ── 1. 安装契约 ─────────────────────────────────────────────────────────────
const pkg = JSON.parse(readFileSync(here('./package.json'), 'utf8'))
const patchPath = here('./cordis.patch.yml')

assert(pkg.name === 'huaxia-calendar-dsh', `包名必须是 unscoped huaxia-calendar-dsh，实际 ${pkg.name}`)
assert(pkg.dsh?.manifestVersion === 1, 'package.json 缺 dsh.manifestVersion: 1')
assert(pkg.dsh?.bundle?.patch === './cordis.patch.yml', 'package.json 缺 dsh.bundle.patch')
assert(pkg.dsh?.client?.platform === 'web', 'dsh.client.platform 必须是 web')
const clientInject = pkg.dsh?.client?.inject ?? []
assert(
  clientInject.includes('@deepseek-ai/dsh-client-ui-layout') &&
    clientInject.includes('@deepseek-ai/dsh-client-ui-sidebar'),
  'dsh.client.inject 必须声明 layout / sidebar（席位由它们声明）',
)
assert(pkg.engines?.dsh === '0.2.2-rc.1', `engines.dsh 必须精确 pin 到 0.2.2-rc.1，实际 ${pkg.engines?.dsh}`)
for (const file of ['lib/index.js', 'lib/index.d.ts', 'lib/client.js']) {
  assert(pkg.files?.includes(file), `package.json files 必须包含 ${file}`)
  assert(existsSync(here(`./${file}`)), `构建产物缺失：${file}（先 npm run build）`)
}
assert(existsSync(patchPath), '缺少 cordis.patch.yml')
const patchText = readFileSync(patchPath, 'utf8')
assert(/insert:/.test(patchText) && patchText.includes(pkg.name), 'cordis.patch.yml 必须 insert 一行本包')

// ── 2. bundle 契约（模块加载器接缝） ─────────────────────────────────────────
const bundle = readFileSync(here('./lib/client.js'), 'utf8')
const bundleBytes = statSync(here('./lib/client.js')).size

// 产物里必须带真日历标识（不是 spike 的占位页），且体积说明算法被打了进来。
for (const marker of ['华夏文明日历', '今日一屏', '今日暂无条目', '节气', '农历', '立春']) {
  assert(bundle.includes(marker), `bundle 里缺少真日历标识「${marker}」`)
}
for (const placeholder of ['农历数据待接入', 'M0–M1 接入', 'lunarPlaceholder']) {
  assert(!bundle.includes(placeholder), `bundle 里还残留 spike 占位文案「${placeholder}」`)
}
assert(bundleBytes > 200_000, `bundle 只有 ${bundleBytes} 字节，农历算法（vendor lunar）没有被打进产物`)
const PLATFORM_MODULES = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
]

let registered
const requiredIds = []

/** 极简 React 替身：让带 hook 的组件能在 Node 里跑一遍渲染。 */
const reactStub = {
  createElement: (type, props, ...children) => {
    const nextProps = { ...(props ?? {}) }
    if (children.length === 1) nextProps.children = children[0]
    else if (children.length > 1) nextProps.children = children
    return { type, props: nextProps }
  },
  Fragment: Symbol('Fragment'),
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useMemo: (factory) => factory(),
  useCallback: (fn) => fn,
  useRef: (value) => ({ current: value }),
  useEffect: () => {},
  useLayoutEffect: () => {},
  forwardRef: (fn) => fn,
}
const jsxRuntimeStub = (() => {
  const jsx = (type, config, key) => ({
    type,
    props: config ?? {},
    ...(key === undefined ? {} : { key }),
  })
  return { jsx, jsxs: jsx, jsxDEV: jsx, Fragment: Symbol('Fragment') }
})()

const requireStub = (id) => {
  requiredIds.push(id)
  if (id === 'react') return reactStub
  if (id === 'react/jsx-runtime') return jsxRuntimeStub
  throw new Error(`bundle 请求了宿主模块表之外的模块：${id}`)
}

globalThis.window = {
  __ModuleLoader__: {
    load: (record) => {
      registered = record
    },
  },
}

// 执行 bundle 的唯一副作用应该是向加载器登记 factory。
new Function(bundle)()

assert(registered !== undefined, 'bundle 没有调用 window.__ModuleLoader__.load')
assert(registered.id === pkg.name, `bundle id ${registered.id} 与包名 ${pkg.name} 不一致`)

const mod = registered.factory(requireStub)
assert(typeof mod.apply === 'function', 'bundle 没有导出 apply()')
assert(mod.name === pkg.name, `bundle 导出的插件名 ${mod.name} 与包名不一致`)
assert(Array.isArray(mod.inject) && mod.inject.includes('slots'), '插件必须 inject slots 服务')

assert(requiredIds.includes('react'), 'react 必须是 external（由宿主提供）')
assert(requiredIds.includes('react/jsx-runtime'), 'react/jsx-runtime 必须是 external')
assert(
  requiredIds.every((id) => PLATFORM_MODULES.includes(id)),
  `bundle 引入了宿主模块表之外的依赖：${requiredIds.filter((id) => !PLATFORM_MODULES.includes(id)).join(', ')}`,
)
assert(!bundle.includes('require("@shishu/'), '日历算法/内容包必须打进 bundle，不能留在 external')

// ── 3. 席位契约 ─────────────────────────────────────────────────────────────
const registrations = []
const injected = []
const ctx = {
  effect: (factory, label) => {
    const disposer = factory()
    assert(typeof disposer === 'function', `ctx.effect「${String(label)}」必须返回 disposer`)
    return disposer
  },
  slots: {
    inject: (key, callback) => {
      injected.push(key)
      return callback()
    },
    register: (options, component) => {
      registrations.push({ options, component })
      return () => {}
    },
  },
}

mod.apply(ctx)

const expected = [
  { name: 'sidebar.panellist', id: 'huaxia-calendar', order: 100, label: '华夏日历' },
  { name: 'main', key: 'huaxia-calendar' },
  { name: 'shell.overlay', id: 'huaxia-calendar.today' },
]
assert(
  registrations.length === expected.length,
  `期望 ${expected.length} 个席位注册，实际 ${registrations.length} 个`,
)
expected.forEach((want, index) => {
  const got = registrations[index]?.options
  assert(got !== undefined, `第 ${index + 1} 个席位没有注册`)
  for (const [key, value] of Object.entries(want)) {
    assert(
      got[key] === value,
      `第 ${index + 1} 个席位 ${key} = ${JSON.stringify(got[key])}，期望 ${JSON.stringify(value)}`,
    )
  }
  assert(typeof registrations[index].component === 'function', `第 ${index + 1} 个席位没有组件`)
})
for (const seat of expected) {
  assert(injected.includes(seat.name), `没有等待 ${seat.name} 的声明（ctx.slots.inject）`)
}

// ── 4. 真日历逻辑：渲染冒烟 + 与 core 对账 ─────────────────────────────────
function collect(node, result = { elements: [], texts: [] }) {
  if (node === null || node === undefined || typeof node === 'boolean') return result
  if (Array.isArray(node)) {
    for (const child of node) collect(child, result)
    return result
  }
  if (typeof node === 'string' || typeof node === 'number') {
    result.texts.push(String(node))
    return result
  }
  if (typeof node === 'object' && 'type' in node) {
    result.elements.push(node)
    collect(node.props?.children, result)
  }
  return result
}
const textOf = (tree) => collect(tree).texts.join(' ')

const iconTree = registrations[0].component({ size: 16, active: false })
const panelTree = registrations[1].component({})
const pillTree = registrations[2].component({})

// 4a. 侧栏图标：真的画了一只 SVG
const iconRoot = collect(iconTree)
assert(iconRoot.elements.some((el) => el.type === 'svg'), '侧栏图标没有渲染出 svg')

// 4b. 主面板：7×N 月网格 + 中文表头
const panel = collect(panelTree)
const panelText = panel.texts.join(' ')
assert(
  panel.elements.some((el) => el.props?.['data-huaxia-calendar-panel'] !== undefined),
  '主面板缺少根节点 data-huaxia-calendar-panel',
)
assert(panelText.includes('华夏文明日历'), '主面板没有标题「华夏文明日历」')
assert(panelText.includes('今日一屏'), '主面板缺少「今日一屏」')
assert(panelText.includes('历史叙事'), '主面板缺少历史叙事区块')
assert(panelText.includes('干支'), '主面板缺少干支行')
assert(panelText.includes('节气'), '主面板缺少节气行')
assert(!panelText.includes('农历数据待接入'), '主面板仍是 spike 占位文案')

const dayCells = panel.elements.filter((el) => el.props?.['data-huaxia-day'] !== undefined)
assert(dayCells.length >= 28 && dayCells.length % 7 === 0, `月网格应为 7 的倍数，实际 ${dayCells.length}`)
assert(dayCells.length <= 42, `月网格最多 42 格，实际 ${dayCells.length}`)
for (const cell of dayCells) {
  assert(typeof cell.props['data-date'] === 'string', '月网格格子缺少 data-date')
  assert(typeof cell.props['aria-label'] === 'string', '月网格格子缺少 aria-label')
}

// 4c. 用 core 的实算结果对账「今天」：农历日、节气
const now = new Date()
const today = { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() }
const todayKey = `${today.year}-${today.month}-${today.day}`
const todayLunar = solarToLunar(today)
const todayGanZhi = getGanZhi(today)

const todayCell = dayCells.find((cell) => cell.props['data-date'] === todayKey)
assert(todayCell !== undefined, `月网格里没有今天 ${todayKey} 的格子`)
assert(
  String(todayCell.props['aria-label']).includes(todayLunar.lunarDayName),
  `今天格子的农历日与 core 不一致：期望 ${todayLunar.lunarDayName}`,
)
assert(
  String(todayCell.props['aria-label']).includes('今天'),
  '今天格子的 aria-label 没有标记「今天」',
)
assert(panelText.includes(todayLunar.lunarDateName), `主面板没有今天的完整农历日期 ${todayLunar.lunarDateName}`)
assert(panelText.includes(todayGanZhi.year), `主面板没有今天的干支年 ${todayGanZhi.year}`)
assert(SOLAR_TERM_NAMES.some((name) => panelText.includes(name)), '月历里一个节气名都没有，节气逻辑没接上')

// 当月节气必须落在对应格子里
const termCells = getSolarTerms(today.year).filter((term) => term.solar.month === today.month)
assert(termCells.length >= 2, `${today.year} 年 ${today.month} 月的节气数据异常`)
for (const term of termCells) {
  const cell = dayCells.find(
    (el) => el.props['data-date'] === `${term.solar.year}-${term.solar.month}-${term.solar.day}`,
  )
  assert(cell !== undefined, `月网格里找不到节气 ${term.name} 的格子`)
  assert(textOf(cell).includes(term.name), `节气 ${term.name} 的格子里没有节气名`)
}

// 4d. 历史叙事：有内容包条目就渲染标题，没有就降级为「今日暂无条目」
const todayEvent = getEventForDate(today.month, today.day)
if (todayEvent !== undefined) {
  assert(panelText.includes(todayEvent.title), `主面板没有渲染今天的历史叙事「${todayEvent.title}」`)
} else {
  assert(panelText.includes('今日暂无条目'), '内容包今天没有条目，主面板没有降级为「今日暂无条目」')
}

// 4e. 今日浮标
const pill = collect(pillTree)
assert(
  pill.elements.some((el) => el.props?.['data-huaxia-today-pill'] !== undefined),
  '今日浮标缺少根节点 data-huaxia-today-pill',
)
const pillText = pill.texts.join(' ')
assert(
  pillText.includes(todayLunar.lunarDayName),
  `今日浮标没有今天的农历日 ${todayLunar.lunarDayName}`,
)
assert(
  pillText.includes(todayGanZhi.year) || SOLAR_TERM_NAMES.some((name) => pillText.includes(name)),
  '今日浮标既没有干支年也没有节气',
)

// ── 输出 ────────────────────────────────────────────────────────────────────
const kb = (bytes) => `${(bytes / 1024).toFixed(2)} kB`
console.log('package            :', pkg.name, pkg.version)
console.log('engines.dsh        :', pkg.engines.dsh)
console.log('bundle id          :', registered.id)
console.log('plugin name        :', mod.name)
console.log('module inject      :', mod.inject.join(', '))
console.log('platform requires  :', requiredIds.join(', '))
console.log('bundle size        :', kb(bundleBytes), '（lib/client.js 未压缩；算法与内容包已打入）')
console.log('slot declarations  :', injected.join(', '))
for (const { options } of registrations) {
  const key = options.key ?? options.id
  console.log(`registered         : ${options.name.padEnd(20)} ${String(key).padEnd(22)} ${options.label ?? ''}`)
}
console.log('month grid         :', `${dayCells.length} 格 (${dayCells.length / 7} 行 × 7)`)
console.log('today (core 对账)  :', `${todayLunar.lunarDateName} · ${todayGanZhi.year}年 · ${todayGanZhi.day}日`)
console.log('solar terms (本月) :', termCells.map((term) => term.name).join('、'))
console.log('today narrative    :', todayEvent === undefined ? '（无条目 → 已降级）' : `${todayEvent.yearLabel} ${todayEvent.title}`)
console.log('\nOK: bundle 通过模块加载器接缝，注册 3 个席位，月历/节气/农历/叙事与 core 实算一致。')
