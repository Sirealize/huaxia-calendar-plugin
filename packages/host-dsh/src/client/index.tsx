/**
 * 浏览器半侧：把「华夏文明日历」注册进 DeepSeek Harness 的席位（0.2.0）。
 *
 * 1. `main`（keyed）：中央整页月历 + 当日一屏 —— 用户明确要求**保留**；
 * 2. `settings.section`（list）：设置页里的「华夏日历」分区 —— 取代原来的左侧栏菜单行；
 * 3. `shell.overlay`（list）：左下角常驻月历 —— 取代原来的右下角「今日」浮标。
 *
 * 与 0.1.0 的差别：
 * - **不再注册左侧栏导航行席位**，左侧栏不再多占一行；
 * - 浮标删掉，`shell.overlay` 里换成一个能看当月每一天、可拖动/可收起的小月历。
 *
 * 所有日历 UI 都在 `@shishu/ui-react` 里（宿主无关的 React 组件），这里只负责
 * 宿主契约：slot 注册 + 生命周期 + 用 props 把宿主动作（打开面板）传进去。
 * React 由宿主的冻结模块表提供，插件不打包它。
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import { createElement, useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import {
  CalendarPanel,
  HuaxiaSettingsSection,
  MiniCalendar,
  createMiniCalendarStore,
} from '@shishu/ui-react'
import { PANEL_ID, PLUGIN_NAME, REGISTERED_SEATS, SEATS } from './seats.ts'

export const name = PLUGIN_NAME

/** `apply` 前必须就绪的服务：slot 注册表 + 布局面板选择器。 */
export const inject = ['slots', 'layout']

/**
 * 注册三个席位。
 *
 * `ctx.slots.inject(slot, cb)` 是「声明感知」的：slot 已声明就同步执行，否则等
 * 声明它的插件 `register()` 时再执行。`ctx.effect` 把注册绑到本插件的 fiber：
 * 插件停用/卸载时 cordis 自动跑 disposer，席位随之消失，没有悬挂状态。
 */
export function apply(ctx: ClientContext): void {
  // 左下角卡片与设置分区共享同一份本地偏好（显隐 / 收起 / 拖拽位置）。
  const miniStore = createMiniCalendarStore()

  /**
   * 打开中央整页月历。
   *
   * `ctx.layout.selectPanel(id)` 是宿主的布局服务；面板 id 必须等于 `main` 的 key。
   * ui-react 不 import 任何 `@deepseek-ai/*`，所以这个动作只能由宿主半侧注入。
   */
  const openFullCalendar = (): void => {
    ctx.layout.selectPanel(PANEL_ID as MainPanelId)
  }

  // 1. 中央整页月历：keyed 席位，key 即面板 id。
  ctx.effect(
    () =>
      ctx.slots.inject(SEATS.main.name, () =>
        ctx.slots.register({ name: SEATS.main.name, key: SEATS.main.key }, CalendarPanel),
      ),
    'huaxia-calendar: 整页月历',
  )

  // 2. 设置分区：list 席位，id 是分区 key，order 排最后，label 是设置导航里的文字。
  //    分区内容拿到宿主给的 `close()`（打开完整日历后顺手关掉设置弹窗）。
  function SettingsSection(props: { close: () => void }): ReactElement {
    return createElement(HuaxiaSettingsSection, {
      store: miniStore,
      onOpenFullCalendar: openFullCalendar,
      onClose: props.close,
    })
  }
  ctx.effect(
    () =>
      ctx.slots.inject(SEATS.settings.name, () =>
        ctx.slots.register(
          {
            name: SEATS.settings.name,
            id: SEATS.settings.id,
            order: SEATS.settings.order,
            label: SEATS.settings.label,
          },
          SettingsSection,
        ),
      ),
    'huaxia-calendar: 设置分区',
  )

  // 3. 左下角常驻月历：additive list 席位；浮层本身点击穿透，卡片自己开 pointer-events。
  function MiniCalendarEntry(): ReactElement {
    return createElement(MiniCalendar, {
      store: miniStore,
      onOpenFullCalendar: openFullCalendar,
      defaultAnchor: useContentAnchor(),
    })
  }
  ctx.effect(
    () =>
      ctx.slots.inject(SEATS.overlay.name, () =>
        ctx.slots.register({ name: SEATS.overlay.name, id: SEATS.overlay.id }, MiniCalendarEntry),
      ),
    'huaxia-calendar: 左下角月历',
  )
}

/** 主内容区左下角在视口里的锚点（像素）。 */
interface ContentAnchor {
  left: number
  bottom: number
}

/** 卡片与主内容区边缘的留白（px）。 */
const ANCHOR_GAP = 12

/**
 * 计算「主内容区左下角」锚点。
 *
 * 为什么不直接贴视口左下角：DSH 的左侧栏就在那，底部是账号 / 设置入口。
 * 一个常驻卡片压在上面，用户就点不到设置了（实测复现）。
 *
 * 所以默认锚到主内容区（`[data-conversation-region]`，宿主给自动化/插件用的
 * 稳定 data 属性）的左下角：侧栏展开时它在右侧，侧栏收起时自动贴到视口左边。
 * 侧栏折叠会改变该区域宽度，用 `ResizeObserver` 跟上；找不到主内容区时
 * （例如打开了整页月历面板）沿用上一次的测量值，绝不回落到挡住侧栏的坐标。
 *
 * @returns 锚点；还没测量到时为 `undefined`（ui-react 退化为自己 12px 留白）。
 */
function useContentAnchor(): ContentAnchor | undefined {
  const [anchor, setAnchor] = useState<ContentAnchor | undefined>(undefined)

  useEffect(() => {
    if (typeof document === 'undefined') return undefined
    let observer: ResizeObserver | undefined

    const measure = (): void => {
      const region = document.querySelector('[data-conversation-region]')
      if (region === null) return
      const rect = region.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      const next: ContentAnchor = {
        left: Math.round(rect.left + ANCHOR_GAP),
        bottom: Math.round(Math.max(0, window.innerHeight - rect.bottom) + ANCHOR_GAP),
      }
      setAnchor((prev) =>
        prev !== undefined && prev.left === next.left && prev.bottom === next.bottom ? prev : next,
      )
    }

    measure()
    const region = document.querySelector('[data-conversation-region]')
    if (region !== null && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure)
      observer.observe(region)
    }
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  return anchor
}

/** 供宿主诊断面板 / verify 使用：本插件占用的席位清单（不含已删除的侧栏行）。 */
export const seats = {
  panelId: PANEL_ID,
  registered: REGISTERED_SEATS,
} as const
