/**
 * 离线契约校验：不启动 GUI、不开浏览器，验证构建产物「装得进、点得到、是真日历」。
 *
 * 0.2.0 的断言重点（用户三条意见的落地证据）：
 *   A. 主题跟随：bundle 里不再有自造配色/字体栈，只剩宿主 `--dsw-*` token；
 *   B. 入口搬家：注册 `main` + `settings.section` + `shell.overlay`，
 *      **没有** `sidebar.panellist`，产物里不再有「今日浮标」相关文案；
 *   C. 左下角月历：默认贴左下角、`pointer-events: auto`、7×N 网格带农历、
 *      年/月翻页按钮、点击日期后的信息行、收起/展开、位置持久化。
 *
 * 它做四类断言：
 *   1. 安装契约：`package.json.dsh` 清单 + `cordis.patch.yml` + `engines.dsh` 精确版本 + 版本号；
 *   2. bundle 契约：通过 `window.__ModuleLoader__` 接缝，id 与包名一致，平台模块走 external、
 *      `@shishu/*` 被真正打进 bundle，且不含被删除的浮标/侧栏痕迹；
 *   3. 席位契约：三个席位（main / settings.section / shell.overlay）按 0.2.0 的元数据注册，
 *      `sidebar.panellist` 没有被注册；
 *   4. 真日历逻辑：用 React 的轻量替身真的调用组件，检查 7×N 月网格、今天农历与 core 实算一致、
 *      当月节气名出现在格子里、历史叙事降级、设置分区内容、左下角月历的默认位置/翻页/收起态。
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
assert(pkg.version === '0.2.0', `版本号必须是 0.2.0，实际 ${pkg.version}`)
assert(pkg.dsh?.manifestVersion === 1, 'package.json 缺 dsh.manifestVersion: 1')
assert(pkg.dsh?.bundle?.patch === './cordis.patch.yml', 'package.json 缺 dsh.bundle.patch')
assert(pkg.dsh?.client?.platform === 'web', 'dsh.client.platform 必须是 web')
const clientInject = pkg.dsh?.client?.inject ?? []
assert(
  clientInject.includes('@deepseek-ai/dsh-client-ui-layout'),
  'dsh.client.inject 必须声明 layout（main / shell.overlay 席位由它声明）',
)
assert(
  clientInject.includes('@deepseek-ai/dsh-client-ui-settings'),
  'dsh.client.inject 必须声明 settings（settings.section 契约的来源）',
)
assert(
  !clientInject.includes('@deepseek-ai/dsh-client-ui-sidebar'),
  'dsh.client.inject 不应再声明 sidebar：0.2.0 已删除侧栏入口',
)
assert(pkg.engines?.dsh === '0.2.2-rc.1', `engines.dsh 必须精确 pin 到 0.2.2-rc.1，实际 ${pkg.engines?.dsh}`)
for (const file of ['lib/index.js', 'lib/index.d.ts', 'lib/client.js']) {
  assert(pkg.files?.includes(file), `package.json files 必须包含 ${file}`)
  assert(existsSync(here(`./${file}`)), `构建产物缺失：${file}（先 npm run build）`)
}
assert(existsSync(patchPath), '缺少 cordis.patch.yml')
const patchText = readFileSync(patchPath, 'utf8')
assert(/insert:/.test(patchText) && patchText.includes(pkg.name), 'cordis.patch.yml 必须 insert 一行本包')

// ── 2. bundle 契约（模块加载器接缝 + 主题跟随） ─────────────────────────────
const bundle = readFileSync(here('./lib/client.js'), 'utf8')
const bundleBytes = statSync(here('./lib/client.js')).size

// 2a. 产物里必须带真日历标识（不是 spike 的占位页），且体积说明算法被打了进来。
for (const marker of ['华夏文明日历', '今日一屏', '今日暂无条目', '节气', '农历', '立春']) {
  assert(bundle.includes(marker), `bundle 里缺少真日历标识「${marker}」`)
}
for (const placeholder of ['农历数据待接入', 'M0–M1 接入', 'lunarPlaceholder']) {
  assert(!bundle.includes(placeholder), `bundle 里还残留 spike 占位文案「${placeholder}」`)
}
assert(bundleBytes > 200_000, `bundle 只有 ${bundleBytes} 字节，农历算法（vendor lunar）没有被打进产物`)

// 2b. 主题跟随：只用宿主 token，不再自带宣纸/朱砂色与自定义字体栈。
for (const token of [
  '--dsw-alias-bg-base',
  '--dsw-alias-bg-layer-1',
  '--dsw-alias-bg-layer-2',
  '--dsw-alias-bg-layer-3',
  '--dsw-alias-label-primary',
  '--dsw-alias-label-secondary',
  '--dsw-alias-label-tertiary',
  '--dsw-alias-label-caption',
  '--dsw-alias-border-l1',
  '--dsw-alias-border-l2',
  '--dsw-alias-border-l3',
  '--dsw-alias-brand-primary',
  '--dsw-alias-state-error-primary',
  '--dsw-alias-state-warn-primary',
  '--dsw-alias-state-success-primary',
  '--dsw-alias-interactive-bg-hover',
  '--dsw-alias-interactive-bg-active',
  '--dsw-elevation-panel',
  '--dsw-elevation-soft',
  '--dsh-font-family-text',
  '--dsh-content-font-size',
]) {
  assert(bundle.includes(token), `主题 token 缺失：${token}（UI 必须跟随宿主主题）`)
}
for (const stale of ['宣纸', '#f7f1e3', '#a63b2a', 'Songti SC', 'Noto Serif CJK SC', '--hx-paper']) {
  assert(!bundle.includes(stale), `bundle 里还残留自造配色/字体「${stale}」`)
}

// 2c. 0.2.0 删除项：右下角浮标与侧栏入口都不该再出现在产物里。
for (const removed of [
  'TodayPill',
  'data-huaxia-today-pill',
  '今日浮标',
  'sidebar.panellist',
]) {
  assert(!bundle.includes(removed), `bundle 里还残留 0.1.0 的「${removed}」`)
}

// 2d. 左下角月历的关键实现必须在产物里（默认位置、持久化键、收起态、点击穿透）。
for (const marker of [
  'data-huaxia-mini-calendar',
  'data-huaxia-mini-handle',
  'data-huaxia-mini-grid',
  'data-huaxia-mini-detail',
  'data-huaxia-mini-collapsed',
  'huaxia-calendar.mini.v1',
  'pointerEvents',
  '打开完整日历',
  '在角落显示月历',
  '回到今天',
  '上一年',
  '上一个月',
]) {
  assert(bundle.includes(marker), `左下角月历的实现标记缺失：${marker}`)
}

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
  innerWidth: 1440,
  innerHeight: 900,
}

/** 假的 localStorage：预设偏好，并记录插件的写入（验证「位置/收起状态会持久化」）。 */
function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial))
  const writes = []
  return {
    writes,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
      writes.push({ key, value })
    },
    removeItem: (key) => {
      data.delete(key)
    },
  }
}

// 执行 bundle 的唯一副作用应该是向加载器登记 factory。
new Function(bundle)()

assert(registered !== undefined, 'bundle 没有调用 window.__ModuleLoader__.load')
assert(registered.id === pkg.name, `bundle id ${registered.id} 与包名 ${pkg.name} 不一致`)

const mod = registered.factory(requireStub)
assert(typeof mod.apply === 'function', 'bundle 没有导出 apply()')
assert(mod.name === pkg.name, `bundle 导出的插件名 ${mod.name} 与包名不一致`)
assert(Array.isArray(mod.inject) && mod.inject.includes('slots'), '插件必须 inject slots 服务')
assert(mod.inject.includes('layout'), '插件必须 inject layout 服务（打开完整月历用 ctx.layout.selectPanel）')

assert(requiredIds.includes('react'), 'react 必须是 external（由宿主提供）')
assert(requiredIds.includes('react/jsx-runtime'), 'react/jsx-runtime 必须是 external')
assert(
  requiredIds.every((id) => PLATFORM_MODULES.includes(id)),
  `bundle 引入了宿主模块表之外的依赖：${requiredIds.filter((id) => !PLATFORM_MODULES.includes(id)).join(', ')}`,
)
assert(!bundle.includes('require("@shishu/'), '日历算法/内容包必须打进 bundle，不能留在 external')

// ── 3. 席位契约 ─────────────────────────────────────────────────────────────
/** 造一个最小 ctx：effect 立即执行、slots.inject 直接 resolve、layout 记录选择。 */
function createCtx() {
  const registrations = []
  const injected = []
  const selectedPanels = []
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
    layout: {
      selectPanel: (panelId) => {
        selectedPanels.push(panelId)
      },
    },
  }
  return { ctx, registrations, injected, selectedPanels }
}

// 3a. 默认（展开、显示）偏好下的席位注册。
globalThis.localStorage = fakeStorage()
const first = createCtx()
mod.apply(first.ctx)
const { registrations, injected } = first

const expected = [
  { name: 'main', key: 'huaxia-calendar' },
  { name: 'settings.section', id: 'huaxia-calendar', order: 1000, label: '华夏日历' },
  { name: 'shell.overlay', id: 'huaxia-calendar.mini' },
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
// 3b. 侧栏入口必须彻底消失（用户意见②）。
assert(!injected.includes('sidebar.panellist'), '仍然 inject 了 sidebar.panellist：侧栏会多出一行菜单')
assert(
  !registrations.some((entry) => entry.options.name === 'sidebar.panellist'),
  '仍然注册了 sidebar.panellist：侧栏会多出一行菜单',
)

// ── 4. 真日历逻辑：渲染冒烟 + 与 core 对账 ─────────────────────────────────
/**
 * 把 React 元素树摊平成「元素 + 文本」。
 *
 * 席位注册的组件可能只是薄包装（例如 `() => createElement(HuaxiaSettingsSection, props)`），
 * 所以遇到函数组件要真的调用一次，才能看到它内部渲染出的结构。
 */
function collect(node, result = { elements: [], texts: [] }, depth = 0) {
  if (node === null || node === undefined || typeof node === 'boolean') return result
  if (Array.isArray(node)) {
    for (const child of node) collect(child, result, depth)
    return result
  }
  if (typeof node === 'string' || typeof node === 'number') {
    result.texts.push(String(node))
    return result
  }
  if (typeof node === 'object' && 'type' in node) {
    if (typeof node.type === 'function') {
      assert(depth < 16, '组件树嵌套过深，可能有无限递归')
      collect(node.type({ ...(node.props ?? {}) }), result, depth + 1)
      return result
    }
    result.elements.push(node)
    collect(node.props?.children, result, depth + 1)
  }
  return result
}
const textOf = (tree) => collect(tree).texts.join(' ')
const byData = (tree, attr) =>
  collect(tree).elements.filter((el) => el.props?.[attr] !== undefined)

const panelTree = registrations[0].component({})
const settingsTree = registrations[1].component({ close: () => {} })
const miniTree = registrations[2].component({})

// 4a. 主面板（保留项）：7×N 月网格 + 中文表头 + 今日一屏
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
assert(String(todayCell.props['aria-label']).includes('今天'), '今天格子的 aria-label 没有标记「今天」')
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

// 历史叙事：有内容包条目就渲染标题，没有就降级为「今日暂无条目」
const todayEvent = getEventForDate(today.month, today.day)
if (todayEvent !== undefined) {
  assert(panelText.includes(todayEvent.title), `主面板没有渲染今天的历史叙事「${todayEvent.title}」`)
} else {
  assert(panelText.includes('今日暂无条目'), '内容包今天没有条目，主面板没有降级为「今日暂无条目」')
}

// 4b. 设置分区（用户意见②）：标题 + 说明 + 打开完整日历 + 显示开关
const settings = collect(settingsTree)
const settingsText = settings.texts.join(' ')
assert(
  settings.elements.some((el) => el.props?.['data-huaxia-settings-section'] !== undefined),
  '设置分区缺少根节点 data-huaxia-settings-section',
)
assert(settingsText.includes('华夏日历'), '设置分区没有标题「华夏日历」')
assert(settingsText.includes('打开完整日历'), '设置分区缺少「打开完整日历」按钮')
assert(settingsText.includes('在角落显示月历'), '设置分区缺少「在角落显示月历」开关')
assert(settingsText.includes('完整月历'), '设置分区没有说明中央面板的完整月历')
const switchButton = settings.elements.find((el) => el.props?.role === 'switch')
assert(switchButton !== undefined, '设置分区缺少 role=switch 的显示开关')
assert(switchButton.props['aria-checked'] === true, '显示开关默认应为打开（aria-checked=true）')

// 4c. 左下角月历（用户意见③）：默认左下角、点击穿透、7×N 网格、农历、翻页
const mini = collect(miniTree)
const miniText = mini.texts.join(' ')
const miniRoot = mini.elements.find((el) => el.props?.['data-huaxia-mini-calendar'] !== undefined)
assert(miniRoot !== undefined, '左下角月历缺少根节点 data-huaxia-mini-calendar')
assert(miniRoot.props['data-huaxia-mini-state'] === 'expanded', '左下角月历默认应为展开态')
assert(miniRoot.props['data-huaxia-mini-collapsed'] === undefined, '展开态不应带 data-huaxia-mini-collapsed')
assert(miniRoot.props.style?.pointerEvents === 'auto', 'shell.overlay 点击穿透，卡片必须显式 pointer-events: auto')
assert(miniRoot.props.style?.position === 'fixed', '左下角月历必须是 fixed 定位（浮层内）')
assert(miniRoot.props.style?.left === 12, `默认位置左边距应为 12px，实际 ${miniRoot.props.style?.left}`)
assert(miniRoot.props.style?.bottom === 12, `默认位置应贴底 12px，实际 ${miniRoot.props.style?.bottom}`)
assert(miniRoot.props.style?.right === undefined, '默认位置不应贴右边（用户不要右下角）')

const miniCells = mini.elements.filter((el) => el.props?.['data-huaxia-mini-day'] !== undefined)
assert(
  miniCells.length >= 28 && miniCells.length % 7 === 0,
  `左下角月历应渲染整月网格（7 的倍数），实际 ${miniCells.length}`,
)
assert(miniCells.length <= 42, `左下角月历最多 42 格，实际 ${miniCells.length}`)
const miniTodayCell = miniCells.find((cell) => cell.props['data-date'] === todayKey)
assert(miniTodayCell !== undefined, `左下角月历里没有今天 ${todayKey} 的格子`)
assert(
  String(miniTodayCell.props['aria-label']).includes(todayLunar.lunarDayName),
  `左下角月历今天格子的农历日与 core 不一致：期望 ${todayLunar.lunarDayName}`,
)
// 每格都能看懂农历：第二行是农历日名 / 农历月名 / 节气名
for (const cell of miniCells) {
  const label = textOf(cell)
  assert(label.length > 0, '左下角月历格子没有任何文字')
}

// 星期表头（周日…周六）+ 年月标题 + 翻页按钮
for (const weekday of ['日', '一', '二', '三', '四', '五', '六']) {
  assert(miniText.includes(weekday), `左下角月历缺少星期表头「${weekday}」`)
}
const miniTitle = mini.elements.find((el) => el.props?.['data-huaxia-mini-title'] !== undefined)
assert(miniTitle !== undefined, '左下角月历缺少年月标题')
assert(
  textOf(miniTitle) === `${today.year}年${today.month}月`,
  `左下角月历年月标题应为 ${today.year}年${today.month}月，实际 ${textOf(miniTitle)}`,
)
const miniLabels = mini.elements
  .filter((el) => el.type === 'button')
  .map((el) => String(el.props?.['aria-label'] ?? ''))
for (const label of ['上一年', '上一个月', '下一个月', '下一年', '回到今天', '打开完整日历', '收起月历', '隐藏月历（可在设置里重新打开）']) {
  assert(miniLabels.includes(label), `左下角月历缺少按钮「${label}」，实际有 ${miniLabels.join(' / ')}`)
}

// 点击某天后的信息行（农历 + 干支 + 节气/节日/叙事）
const miniDetail = mini.elements.find((el) => el.props?.['data-huaxia-mini-detail'] !== undefined)
assert(miniDetail !== undefined, '左下角月历缺少选中日信息行')
const miniDetailText = textOf(miniDetail)
assert(miniDetailText.includes(todayLunar.lunarDayName), `选中日信息行没有今天的农历「${todayLunar.lunarDayName}」`)
assert(miniDetailText.includes(`${todayGanZhi.day}日`), `选中日信息行没有干支日 ${todayGanZhi.day}`)

// 4d. 收起态 + 位置恢复：换一份「已收起、已拖到 (40, 50)」的 localStorage 重新装一遍
globalThis.localStorage = fakeStorage({
  'huaxia-calendar.mini.v1': '{"position":{"x":40,"y":50},"collapsed":true,"visible":true}',
})
const second = createCtx()
mod.apply(second.ctx)
const collapsedTree = second.registrations[2].component({})
const collapsed = collect(collapsedTree)
const collapsedRoot = collapsed.elements.find(
  (el) => el.props?.['data-huaxia-mini-calendar'] !== undefined,
)
assert(collapsedRoot !== undefined, '收起态没有渲染卡片')
assert(
  collapsedRoot.props['data-huaxia-mini-state'] === 'collapsed',
  'storage 里 collapsed=true 时卡片应为收起态',
)
assert(
  collapsedRoot.props['data-huaxia-mini-collapsed'] !== undefined,
  '收起态缺少 data-huaxia-mini-collapsed 标记',
)
assert(
  collapsedRoot.props.style?.left === 40 && collapsedRoot.props.style?.top === 50,
  `拖拽位置应从 localStorage 恢复（40,50），实际 (${collapsedRoot.props.style?.left},${collapsedRoot.props.style?.top})`,
)
const collapsedText = collapsed.texts.join(' ')
assert(collapsedText.includes(todayLunar.lunarDayName), '收起态小条没有今天农历日')
assert(collapsedText.includes('展开月历') === false, '收起态的展开按钮是 aria-label，不该出现在文本里')
assert(
  collapsed.elements.some((el) => el.props?.['aria-label'] === '展开月历'),
  '收起态缺少「展开月历」按钮',
)
assert(
  collapsed.elements.every((el) => el.props?.['data-huaxia-mini-day'] === undefined),
  '收起态不应再渲染整月网格',
)

// 4e. 隐藏态：设置里关掉「在角落显示月历」后卡片不渲染
globalThis.localStorage = fakeStorage({
  'huaxia-calendar.mini.v1': '{"visible":false}',
})
const third = createCtx()
mod.apply(third.ctx)
const hiddenTree = collect(third.registrations[2].component({}))
assert(
  hiddenTree.elements.every((el) => el.props?.['data-huaxia-mini-calendar'] === undefined),
  'visible=false 时左下角月历必须不渲染',
)
assert(hiddenTree.texts.length === 0, 'visible=false 时左下角月历不该有可见文案')

// 4f. 设置卡片里的开关是同一个 store：关掉后 store 会写 localStorage
globalThis.localStorage = fakeStorage()
const fourth = createCtx()
mod.apply(fourth.ctx)
const writableSettings = collect(fourth.registrations[1].component({ close: () => {} }))
const writableSwitch = writableSettings.elements.find((el) => el.props?.role === 'switch')
assert(writableSwitch !== undefined, '设置卡片没有找到开关')
assert(typeof writableSwitch.props.onClick === 'function', '设置开关没有点击处理')
writableSwitch.props.onClick()
const writes = globalThis.localStorage.writes.filter((entry) => entry.key === 'huaxia-calendar.mini.v1')
assert(writes.length > 0, '点开关后没有把状态写进 localStorage')
assert(JSON.parse(writes[writes.length - 1].value).visible === false, '点开关后应为「不显示」')

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
console.log('removed seats      : sidebar.panellist、右下角今日浮标（0.2.0 删除）')
console.log('theme tokens       : 仅宿主 --dsw-* / --dsh-*（宣纸/朱砂/宋体已清除）')
console.log('month grid         :', `${dayCells.length} 格 (${dayCells.length / 7} 行 × 7)`)
console.log('today (core 对账)  :', `${todayLunar.lunarDateName} · ${todayGanZhi.year}年 · ${todayGanZhi.day}日`)
console.log('solar terms (本月) :', termCells.map((term) => term.name).join('、'))
console.log('today narrative    :', todayEvent === undefined ? '（无条目 → 已降级）' : `${todayEvent.yearLabel} ${todayEvent.title}`)
console.log('mini calendar      :', `${miniCells.length} 格 · 默认左下角 · 翻年/翻月/今天 · 收起态与位置可持久化`)
console.log('\nOK: 3 个席位（main / settings.section / shell.overlay），无 sidebar.panellist、无今日浮标；')
console.log('    主题只用宿主 token；左下角月历网格/农历/翻页/收起与 core 实算一致。')
