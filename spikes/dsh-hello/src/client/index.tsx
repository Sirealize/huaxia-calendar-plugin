/**
 * Phase 0 spike — browser half of the Huaxia calendar plugin.
 *
 * What this file is for: it is the executable form of the slot contract this
 * spike verified against the installed DSH 0.2.2-rc.1 packages. Every call below
 * mirrors a pattern taken from a real shipped plugin (see the doc's evidence
 * column); nothing here is invented API.
 *
 * Three seats are claimed, matching the three candidate calendar forms:
 *   1. `sidebar.panellist` + `main` (keyed)  — full calendar page in the centre
 *   2. `shell.overlay` (list)                — always-on "today" pill in a corner
 *   3. `shell.bottom` (single)               — optional full-width today strip
 *      (commented out: occupying it changes frame geometry, see the doc)
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { createElement } from 'react'

/** Panel id used by BOTH the sidebar row and the keyed `main` cell. */
const PANEL_ID = 'huaxia-calendar'

/** Today's Gregorian date, formatted for a Chinese-language surface. */
function todayLabel(): string {
  const now = new Date()
  return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`
}

/** 农历/节气 data is a later milestone; Phase 0 only proves the seat renders. */
function lunarPlaceholder(): string {
  return '农历数据待接入（lunar-javascript 本地实算）'
}

/** Sidebar icon seat: receives `{ size, active }` from the sidebar shell. */
function CalendarIcon(props: { size?: number; active?: boolean }): ReturnType<typeof createElement> {
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
      'aria-hidden': true,
    },
    createElement('rect', { x: 1.5, y: 2.5, width: 13, height: 12, rx: 2 }),
    createElement('path', { d: 'M1.5 6h13M5 1.5v2M11 1.5v2' }),
    createElement('path', { d: 'M5 9.5h2v2H5z', fill: 'currentColor', stroke: 'none' }),
  )
}

/** `main` keyed panel body: gets no Session binding, only global standard props. */
function CalendarPanel(): ReturnType<typeof createElement> {
  return createElement(
    'div',
    { 'data-huaxia-calendar-panel': '', style: { padding: '24px', fontFamily: 'system-ui' } },
    createElement('h1', { style: { margin: '0 0 8px', fontSize: '20px' } }, todayLabel()),
    createElement('p', { style: { margin: '0 0 4px', color: '#666' } }, lunarPlaceholder()),
    createElement('p', { style: { margin: 0, color: '#666' } }, '每日卦象 / 历史叙事 / 任务清单 / Token — M0–M1 接入'),
  )
}

/** `shell.overlay` entry: the frame-wide layer is click-through; opt back in. */
function TodayPill(): ReturnType<typeof createElement> {
  return createElement(
    'div',
    {
      'data-huaxia-today-pill': '',
      style: {
        position: 'fixed',
        right: '16px',
        bottom: '16px',
        padding: '8px 12px',
        borderRadius: '12px',
        background: 'rgba(20,20,20,0.82)',
        color: '#fff',
        font: '12px system-ui',
        pointerEvents: 'auto',
        boxShadow: '0 4px 16px rgba(0,0,0,0.24)',
      },
    },
    todayLabel(),
  )
}

export const name = 'dsh-hello-huaxia'

/** Services that must be ready before `apply` runs (the slot registry). */
export const inject = ['slots']

/**
 * Register the calendar's seats.
 *
 * `ctx.slots.inject(slot, () => ctx.slots.register(...))` is declaration-aware:
 * it runs now when the slot is already declared, otherwise inside the declaring
 * plugin's `register()` call. `ctx.effect` ties the registration to this
 * plugin's fiber, so disabling/unloading the plugin disposes it (and collapses
 * any child slots it declared) with no manual teardown.
 */
export function apply(ctx: ClientContext): void {
  // 1a. Sidebar row: `id` is the panel id, `order` sorts rows, `label` is the
  // accessible name and the collapsed-rail tooltip.
  ctx.effect(
    () =>
      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 100, label: '华夏日历' }, CalendarIcon),
      ),
    'huaxia-calendar: sidebar row',
  )

  // 1b. Centre panel: a keyed cell addressed by the same id. Selecting the
  // sidebar row switches the centre to this panel and parks the conversation.
  ctx.effect(
    () =>
      ctx.slots.inject('main', () =>
        ctx.slots.register({ name: 'main', key: PANEL_ID }, CalendarPanel),
      ),
    'huaxia-calendar: main panel',
  )

  // 2. Frame-wide floating pill: additive list seat, so it never competes with
  // the shipped entries; the layer itself is pointer-transparent.
  ctx.effect(
    () =>
      ctx.slots.inject('shell.overlay', () =>
        ctx.slots.register({ name: 'shell.overlay', id: `${PANEL_ID}.today` }, TodayPill),
      ),
    'huaxia-calendar: today pill',
  )

  // 3. OPTIONAL full-width strip below all three columns. `shell.bottom` is a
  // SINGLE seat and is unoccupied in the shipped composition, but occupying it
  // shortens every column, so it stays out of the spike build.
  // ctx.effect(
  //   () => ctx.slots.inject('shell.bottom', () =>
  //     ctx.slots.register({ name: 'shell.bottom' }, TodayStrip)),
  //   'huaxia-calendar: today strip',
  // )
}
