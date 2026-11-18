/**
 * 浏览器半侧：把「华夏文明日历」注册进 DeepSeek Harness 的三个席位。
 *
 * 1. `sidebar.panellist` + `main`（keyed）：左侧栏「华夏日历」入口 + 中央整页月历；
 * 2. `shell.overlay`（list）：右下角常驻「今日」浮标。
 *
 * 所有日历 UI 都在 `@shishu/ui-react` 里（宿主无关的 React 组件），这里只负责
 * 宿主契约：slot 注册 + 生命周期。React 由宿主的冻结模块表提供，插件不打包它。
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { createElement } from 'react'
import type { ReactElement } from 'react'
import { CalendarPanel, TodayPill } from '@shishu/ui-react'
import { PANEL_ID, PLUGIN_NAME, SEATS } from './seats.ts'

/**
 * 侧栏图标席位：接收 `{ size, active }`。
 *
 * 画一只简化的「日历」轮廓：框 + 装订线 + 一枚朱砂点（今天）。
 */
function CalendarIcon(props: { size?: number; active?: boolean }): ReactElement {
  const size = props.size ?? 16
  return createElement(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.4,
      strokeLinecap: 'round',
      'aria-hidden': true,
    },
    createElement('rect', { x: 1.6, y: 2.6, width: 12.8, height: 11.6, rx: 2 }),
    createElement('path', { d: 'M1.6 6.2h12.8M5.1 1.5v2.3M10.9 1.5v2.3' }),
    createElement('path', {
      d: 'M5.1 9.2h2.3v2.3H5.1z',
      fill: 'currentColor',
      stroke: 'none',
      opacity: props.active === true ? 1 : 0.55,
    }),
    createElement('circle', {
      cx: 10.7,
      cy: 10.4,
      r: 1.15,
      fill: 'currentColor',
      stroke: 'none',
      opacity: props.active === true ? 1 : 0.55,
    }),
  )
}

export const name = PLUGIN_NAME

/** `apply` 前必须就绪的服务：slot 注册表。 */
export const inject = ['slots']

/**
 * 注册三个席位。
 *
 * `ctx.slots.inject(slot, cb)` 是「声明感知」的：slot 已声明就同步执行，否则等
 * 声明它的插件 `register()` 时再执行。`ctx.effect` 把注册绑到本插件的 fiber：
 * 插件停用/卸载时 cordis 自动跑 disposer，席位随之消失，没有悬挂状态。
 */
export function apply(ctx: ClientContext): void {
  // 1a. 左侧栏导航行：id 是面板 id，order 决定行序，label 是无障碍名与收起态 tooltip。
  ctx.effect(
    () =>
      ctx.slots.inject(SEATS.sidebar.name, () =>
        ctx.slots.register(
          {
            name: SEATS.sidebar.name,
            id: SEATS.sidebar.id,
            order: SEATS.sidebar.order,
            label: SEATS.sidebar.label,
          },
          CalendarIcon,
        ),
      ),
    'huaxia-calendar: 侧栏入口',
  )

  // 1b. 中央面板：keyed 席位，与 1a 同 id 才能被侧栏点开。
  ctx.effect(
    () =>
      ctx.slots.inject(SEATS.main.name, () =>
        ctx.slots.register({ name: SEATS.main.name, key: SEATS.main.key }, CalendarPanel),
      ),
    'huaxia-calendar: 整页月历',
  )

  // 2. 右下角今日浮标：additive list 席位，不抢别人的位置；浮层本身点击穿透。
  ctx.effect(
    () =>
      ctx.slots.inject(SEATS.overlay.name, () =>
        ctx.slots.register({ name: SEATS.overlay.name, id: SEATS.overlay.id }, TodayPill),
      ),
    'huaxia-calendar: 今日浮标',
  )
}

/** 供宿主诊断面板/verify 使用：本插件占用的席位清单。 */
export const seats = {
  panelId: PANEL_ID,
  registered: [SEATS.sidebar.name, SEATS.main.name, SEATS.overlay.name],
} as const
