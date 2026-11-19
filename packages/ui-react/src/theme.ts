/**
 * 视觉令牌：**只引用宿主 DSH 的主题 token**（`--dsw-*` / `--dsh-*`）。
 *
 * 0.2.0 的产品意见是「不要自己带色，跟随 DSH 外观」：旧版自造的那套底色、
 * 点缀色、装饰字体栈全部删除，组件里不再出现任何品牌色值。宿主在 light / dark 之间切换时
 * 这些 CSS 变量的值自动变化，所以组件**不需要订阅主题状态**，只消费变量即可。
 *
 * 每个 token 都写成 `var(--token, fallback)`：`verify.mjs` 在没有浏览器的 Node
 * 环境里渲染组件，没有宿主挂的变量，兜底值保证静态结构仍然渲染得出来。
 */
import type { CSSProperties } from 'react'

/** 组件内联样式对象的类型别名（本包不引外部 CSS 文件）。 */
export type CalendarStyle = CSSProperties

/**
 * 宿主主题 token 表。
 *
 * 全部来自 DSH 的 alias 层，随宿主主题切换自动变色；分组顺序与 DSH 主题包一致
 * （背景 / 文字 / 边框 / 强调与状态 / 交互 / 阴影 / 字体）。
 */
export const TOKENS = Object.freeze({
  // 背景层
  bgBase: 'var(--dsw-alias-bg-base, #ffffff)',
  bgLayer1: 'var(--dsw-alias-bg-layer-1, #ffffff)',
  bgLayer2: 'var(--dsw-alias-bg-layer-2, #ffffff)',
  bgLayer3: 'var(--dsw-alias-bg-layer-3, #ffffff)',
  bgModule: 'var(--dsw-alias-bg-module-platform, #f5f6f7)',

  // 文字
  labelPrimary: 'var(--dsw-alias-label-primary, #1b1b1c)',
  labelSecondary: 'var(--dsw-alias-label-secondary, #353638)',
  labelTertiary: 'var(--dsw-alias-label-tertiary, #61666b)',
  labelCaption: 'var(--dsw-alias-label-caption, #adb2b8)',
  labelDimmed: 'var(--dsw-alias-label-dimmed, #e1e5ee)',
  labelPrimaryForeground: 'var(--dsw-alias-label-primary-foreground, #ffffff)',

  // 边框
  borderL1: 'var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.04))',
  borderL2: 'var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1))',
  borderL3: 'var(--dsw-alias-border-l3, rgba(0, 0, 0, 0.12))',

  // 强调 / 状态
  brandPrimary: 'var(--dsw-alias-brand-primary, #1b1b1c)',
  stateError: 'var(--dsw-alias-state-error-primary, #ec1313)',
  stateWarn: 'var(--dsw-alias-state-warn-primary, #f59e0b)',
  stateSuccess: 'var(--dsw-alias-state-success-primary, #22c55e)',

  // 交互反馈
  interactiveHover: 'var(--dsw-alias-interactive-bg-hover, rgba(38, 49, 72, 0.06))',
  interactiveActive: 'var(--dsw-alias-interactive-bg-active, rgba(38, 49, 72, 0.1))',

  // 阴影（DSH 把 elevation 定义在 body 及其后代上，浮层里可直接用）
  elevationPanel:
    'var(--dsw-elevation-panel, 0 0 0 0.5px rgba(0, 0, 0, 0.12), 0 3px 8px rgba(0, 0, 0, 0.04))',
  elevationSoft: 'var(--dsw-elevation-soft, 0 4px 16px rgba(0, 0, 0, 0.04))',

  // 字体
  fontText: 'var(--dsh-font-family-text, var(--dsw-font-family, system-ui, sans-serif))',
  contentFontSize: 'var(--dsh-content-font-size, 14px)',
})

/** 圆角也走宿主 token，避免和宿主界面的圆角风格打架。 */
export const RADIUS = Object.freeze({
  xs: 'var(--dsw-radius-xs, 4px)',
  sm: 'var(--dsw-radius-sm, 8px)',
  md: 'var(--dsw-radius-md, 12px)',
  lg: 'var(--dsw-radius-lg, 16px)',
})

/**
 * 字号：以宿主的正文档位 `--dsh-content-font-size` 为基准做像素增减，
 * 这样用户在宿主设置里放大字号时日历会跟着放大，而不是写死一套尺寸。
 *
 * @param delta - 相对宿主正文档位的像素增减（如 `+8`、`-3`）。
 * @returns 可直接放进 style 的 CSS 长度表达式。
 */
export function fontSize(delta = 0): string {
  const base = TOKENS.contentFontSize
  if (delta === 0) return base
  const operator = delta > 0 ? '+' : '-'
  return `calc(${base} ${operator} ${Math.abs(delta)}px)`
}
