# @shishu/ui-react — 华夏文明日历展示层

宿主无关的 **React 18** 组件：一个整页月历 + 一个今日浮标。不 import 任何
`@deepseek-ai/*`、不引外部 CSS 文件、不打包自己的 React（React 由宿主提供），
所以同一套组件可以直接被 DSH 插件（`huaxia-calendar-dsh`）和将来的 VS Code webview 复用。

数据来源：
- `@shishu/core`：农历 / 节气 / 干支 / 节日，纯函数本地实算，全离线；
- `@shishu/content-l1`：每天一条历史叙事（`getEventForDate(month, day)`，无条目返回 `undefined`）。

## 组件

| 导出 | 说明 |
|------|------|
| `<CalendarPanel />` | 整页月历：月视图（上/下月、回今天）、公历+农历网格、节气、今天高亮、周末弱化；侧边「今日一屏」（公历/农历/干支/生肖/节气/节日/历史叙事） |
| `<TodayPill />` | 极简浮标：农历月日 + 今日节气（无节气时显示干支日），`position: fixed` 右下角、可点 |
| `buildMonthGrid` / `buildDayBrief` / `formatPill` / `formatSolarTermLine` … | 不依赖 React 的纯函数（见 `src/pure/`） |

```tsx
import { CalendarPanel, TodayPill } from '@shishu/ui-react'

// 宿主侧只需要把组件挂进自己的渲染树
render(<CalendarPanel />)
render(<TodayPill />)
```

## 视觉

宣纸底 + 墨色字 + 朱砂点睛，全部通过 **CSS 变量 + 内联 style** 实现：
根节点挂 `--hx-*` 令牌（`src/theme.ts` 的 `PANEL_VARS`），子节点用 `var(--hx-ink)` 等取值。
不依赖 CSS Modules / 外部 CSS 文件（DSH 那条管线尚未发布）。

组件内部状态：

- `today`：挂载时取宿主本地日期，跨零点每 30s 自检一次；
- `view`：当前展示年月，默认今天所在月；
- `selected`：右侧「一屏」对应的日期，默认今天；点任意格子切换。

## 测试 / 类型

```sh
node --test                              # 纯函数测试（月网格、农历文案、节气映射、浮标文案）
../../node_modules/.bin/tsc --noEmit -p tsconfig.json   # 或 npx tsc
```

测试全部不依赖浏览器与内容包的具体条目：涉及内容包时只断言「有就带标题、没有就
返回 undefined」的降级契约，所以队友换内容数据不会打断测试。
