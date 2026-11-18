/**
 * 视觉令牌：宣纸底 / 墨色字 / 朱砂点缀。
 *
 * DSH 的 CSS Modules 管线未发布，插件不能 import 外部 CSS 文件，所以整套视觉
 * 走「根节点挂 CSS 变量 + 子节点用 var() 内联样式」：主题只在 {@link PANEL_VARS}
 * 一处定义，组件里不出现裸色值。
 */
import type { CSSProperties } from 'react'

/** 允许在 style 对象里写 CSS 自定义属性。 */
export type CalendarStyle = CSSProperties & { readonly [key: `--hx-${string}`]: string | number }

/** 墨与纸。 */
export const TOKENS = Object.freeze({
  /** 宣纸主色 */
  paper: '#f7f1e3',
  /** 受光处（标题带） */
  paperHi: '#fdfaf2',
  /** 背光处 / 悬停 */
  paperLo: '#f1e8d4',
  /** 墨 */
  ink: '#241f19',
  /** 淡墨（正文） */
  inkSoft: '#5c5346',
  /** 更淡的墨（辅助信息） */
  inkFaint: '#9a8f7c',
  /** 朱砂（今天 / 节气 / 印章） */
  cinnabar: '#a63b2a',
  /** 朱砂淡底 */
  cinnabarSoft: '#f3e0d9',
  /** 朱砂描边 */
  cinnabarLine: '#d8a898',
  /** 石绿（节气用色） */
  jade: '#3f6b58',
  /** 界栏线 */
  line: '#ded2b8',
  /** 更浅的界栏线 */
  lineSoft: 'rgba(222, 210, 184, 0.55)',
})

/** 标题与数字用宋体，界面文案用无衬线。 */
export const FONT_SERIF =
  '"Songti SC", "Noto Serif CJK SC", "Source Han Serif SC", "STSong", "SimSun", serif'
export const FONT_SANS =
  '"PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Microsoft YaHei", system-ui, sans-serif'

/** 挂在根节点上的 CSS 变量表。 */
export const PANEL_VARS: CalendarStyle = {
  '--hx-paper': TOKENS.paper,
  '--hx-paper-hi': TOKENS.paperHi,
  '--hx-paper-lo': TOKENS.paperLo,
  '--hx-ink': TOKENS.ink,
  '--hx-ink-soft': TOKENS.inkSoft,
  '--hx-ink-faint': TOKENS.inkFaint,
  '--hx-cinnabar': TOKENS.cinnabar,
  '--hx-cinnabar-soft': TOKENS.cinnabarSoft,
  '--hx-cinnabar-line': TOKENS.cinnabarLine,
  '--hx-jade': TOKENS.jade,
  '--hx-line': TOKENS.line,
  '--hx-line-soft': TOKENS.lineSoft,
  '--hx-font-serif': FONT_SERIF,
  '--hx-font-sans': FONT_SANS,
}

/**
 * 宣纸底：受光晕 + 纸纤维。多层 background 叠在一起，纯线性/径向渐变，
 * 不引任何图片资源（对离线与打包体积友好）。
 */
export const PAPER_BACKGROUND = [
  `radial-gradient(1100px 520px at 10% -12%, ${TOKENS.paperHi} 0%, rgba(253, 250, 242, 0) 62%)`,
  `radial-gradient(760px 420px at 96% 4%, rgba(255, 253, 246, 0.9) 0%, rgba(255, 253, 246, 0) 58%)`,
  `repeating-linear-gradient(90deg, rgba(140, 120, 86, 0.035) 0px, rgba(140, 120, 86, 0.035) 1px, rgba(140, 120, 86, 0) 1px, rgba(140, 120, 86, 0) 3px)`,
  `linear-gradient(180deg, ${TOKENS.paper} 0%, #f4ecda 100%)`,
].join(', ')
