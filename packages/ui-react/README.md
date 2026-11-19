# @shishu/ui-react — 华夏文明日历展示层（v0.2.0）

宿主无关的 **React 18** 组件：整页月历 + 左下角常驻小月历 + 设置页分区卡片。
不 import 任何 `@deepseek-ai/*`、不引外部 CSS 文件、不打包自己的 React（React 由宿主提供），
所以同一套组件可以直接被 DSH 插件（`huaxia-calendar-dsh`）和将来的 VS Code webview 复用。

数据来源：
- `@shishu/core`：农历 / 节气 / 干支 / 节日，纯函数本地实算，全离线；
- `@shishu/content-l1`：每天一条历史叙事（`getEventForDate(month, day)`，无条目返回 `undefined`）。

## 组件

| 导出 | 说明 |
|------|------|
| `<CalendarPanel />` | **中央整页月历**（保留）：月视图（上/下月、回今天）、公历+农历网格、节气、今天高亮、周末弱化；侧边「今日一屏」（公历/农历/干支/生肖/节气/节日/历史叙事） |
| `<MiniCalendar />` | **左下角常驻小月历**（0.2.0 新增）：当月每一天 + 农历日、翻年/翻月/回今天、点日期看当日一行信息、标题栏可拖动（视口内钳制）、可收起成小条；`store` 与 `onOpenFullCalendar` 由宿主 props 传入 |
| `<HuaxiaSettingsSection />` | **设置页「华夏日历」分区**（0.2.0 新增）：说明 + 「在角落显示月历」开关 + 「打开完整日历」按钮；`store` / `onOpenFullCalendar` / `onClose` 由宿主传入 |
| `createMiniCalendarStore` / `useMiniCalendarPrefs` | 左下角月历的偏好 store（localStorage 持久化：显隐 / 收起 / 拖拽位置），设置卡片与卡片共享同一份状态 |
| `buildMonthGrid` / `buildDayBrief` / `formatPill` / `formatMiniDayLine` / `shiftYearMonth` / `clampOverlayRect` … | 不依赖 React 的纯函数（见 `src/pure/`） |

```tsx
import { CalendarPanel, MiniCalendar, HuaxiaSettingsSection, createMiniCalendarStore } from '@shishu/ui-react'

const store = createMiniCalendarStore()

// 宿主侧把组件挂进自己的渲染树；打开面板这类宿主动作走回调注入
render(<CalendarPanel />)
render(<MiniCalendar store={store} onOpenFullCalendar={() => ctx.layout.selectPanel('huaxia-calendar')} />)
render(<HuaxiaSettingsSection store={store} onOpenFullCalendar={openPanel} onClose={closeSettings} />)
```

## 视觉：完全跟随宿主主题

0.2.0 起不再自带任何品牌色。所有颜色/字体都来自宿主 DSH 的 CSS 变量，light / dark
切换时自动变化，组件**不订阅**主题状态：

- 背景 `--dsw-alias-bg-base` / `bg-layer-1..3` / `bg-module-platform`
- 文字 `--dsw-alias-label-primary/secondary/tertiary/caption/dimmed/primary-foreground`
- 边框 `--dsw-alias-border-l1/l2/l3`
- 强调 `--dsw-alias-brand-primary`；状态 `state-error/warn/success-primary`
- 交互 `--dsw-alias-interactive-bg-hover/active`；阴影 `--dsw-elevation-panel/soft`
- 字体 `--dsh-font-family-text`、字号 `--dsh-content-font-size`

每个 token 都写成 `var(--token, fallback)`（见 `src/theme.ts` 的 `TOKENS`），因为离线
校验会在没有宿主的 Node 环境里渲染组件。不依赖 CSS Modules / 外部 CSS 文件。

## 测试 / 类型

```sh
node --test                                              # 纯函数 + store 测试（34 个）
../../node_modules/.bin/tsc --noEmit -p tsconfig.json    # 或 npx tsc
```

测试不依赖浏览器与内容包的具体条目：涉及内容包时只断言「有就带标题、没有就走降级」的
契约，所以换内容数据不会打断测试。
