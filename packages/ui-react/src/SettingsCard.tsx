/**
 * `<HuaxiaSettingsSection />` —— 设置页里的「华夏日历」分区（0.2.0 起取代左侧栏菜单项）。
 *
 * 这是一个纯展示组件：所有与宿主的交互（打开中央面板、关闭设置面板）都由宿主
 * 通过 props 回调传入，`@shishu/ui-react` 依旧不 import 任何 `@deepseek-ai/*`。
 *
 * 分区内容：
 * - 一句说明（整页月历保留在中央面板）；
 * - 「在角落显示月历」开关（控制左下角小日历的显隐，状态存 localStorage）；
 * - 「打开完整日历」按钮。
 */
import type { ReactElement } from 'react'
import type { MiniCalendarStore } from './miniStore.ts'
import { useMiniCalendarPrefs } from './miniStore.ts'
import { RADIUS, TOKENS, fontSize, type CalendarStyle } from './theme.ts'

const cardStyle: CalendarStyle = {
  boxSizing: 'border-box',
  width: '100%',
  maxWidth: 720,
  padding: '16px 18px 6px',
  border: `1px solid ${TOKENS.borderL1}`,
  borderRadius: RADIUS.md,
  background: TOKENS.bgLayer2,
  boxShadow: TOKENS.elevationSoft,
  color: TOKENS.labelPrimary,
  fontFamily: TOKENS.fontText,
  fontSize: TOKENS.contentFontSize,
}

const headStyle: CalendarStyle = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 10,
  flexWrap: 'wrap',
}

const titleStyle: CalendarStyle = {
  margin: 0,
  fontSize: fontSize(2),
  fontWeight: 600,
  letterSpacing: 0.5,
  color: TOKENS.labelPrimary,
}

const badgeStyle: CalendarStyle = {
  fontSize: fontSize(-4),
  letterSpacing: 0.3,
  color: TOKENS.labelTertiary,
}

const introStyle: CalendarStyle = {
  margin: '8px 0 10px',
  fontSize: fontSize(-2),
  lineHeight: 1.7,
  color: TOKENS.labelSecondary,
}

const rowStyle: CalendarStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  padding: '12px 0',
  borderTop: `1px solid ${TOKENS.borderL1}`,
}

const rowTextStyle: CalendarStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
  minWidth: 0,
}

const rowTitleStyle: CalendarStyle = {
  fontSize: fontSize(-0.5),
  lineHeight: 1.4,
  color: TOKENS.labelPrimary,
}

const rowDescStyle: CalendarStyle = {
  fontSize: fontSize(-3),
  lineHeight: 1.5,
  color: TOKENS.labelTertiary,
}

const switchStyle = (on: boolean): CalendarStyle => ({
  appearance: 'none',
  position: 'relative',
  flex: '0 0 auto',
  width: 34,
  height: 20,
  padding: 0,
  border: `1px solid ${on ? TOKENS.brandPrimary : TOKENS.borderL2}`,
  borderRadius: 999,
  background: on ? TOKENS.brandPrimary : TOKENS.bgModule,
  cursor: 'pointer',
  transition: 'background 120ms ease, border-color 120ms ease',
})

const switchKnobStyle = (on: boolean): CalendarStyle => ({
  position: 'absolute',
  top: 2,
  left: on ? 16 : 2,
  width: 14,
  height: 14,
  borderRadius: '50%',
  background: on ? TOKENS.labelPrimaryForeground : TOKENS.labelCaption,
  transition: 'left 120ms ease',
})

const primaryButtonStyle: CalendarStyle = {
  appearance: 'none',
  flex: '0 0 auto',
  padding: '6px 12px',
  border: `1px solid ${TOKENS.brandPrimary}`,
  borderRadius: RADIUS.sm,
  background: TOKENS.brandPrimary,
  color: TOKENS.labelPrimaryForeground,
  fontFamily: TOKENS.fontText,
  fontSize: fontSize(-2),
  lineHeight: 1.4,
  letterSpacing: 0.3,
  cursor: 'pointer',
}

/** 设置页「华夏日历」分区。 */
export interface HuaxiaSettingsSectionProps {
  /** 与左下角月历共用的偏好 store。 */
  store: MiniCalendarStore
  /** 打开宿主中央的完整月历面板。 */
  onOpenFullCalendar?: () => void
  /** 关闭设置面板（打开完整月历后调用，否则设置弹窗会盖住刚打开的页面）。 */
  onClose?: () => void
}

/** 设置页「华夏日历」分区。 */
export function HuaxiaSettingsSection(props: HuaxiaSettingsSectionProps): ReactElement {
  const { store, onOpenFullCalendar, onClose } = props
  const prefs = useMiniCalendarPrefs(store)

  const openFullCalendar = (): void => {
    onOpenFullCalendar?.()
    onClose?.()
  }

  return (
    <section data-huaxia-settings-section="" style={cardStyle} aria-label="华夏日历设置">
      <header style={headStyle}>
        <h2 style={titleStyle}>华夏日历</h2>
        <span style={badgeStyle}>公历 · 农历 · 节气 · 历史叙事 · 全离线</span>
      </header>

      <p style={introStyle}>
        完整月历保留在中央面板；左下角还会常驻一张能看当月每一天的小月历，可以拖动到任意位置、随时收起。
      </p>

      <div style={rowStyle}>
        <span style={rowTextStyle}>
          <span style={rowTitleStyle}>在角落显示月历</span>
          <span style={rowDescStyle}>左下角常驻当月月历，可拖动、可收起；关闭后仍可在设置里重新打开。</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={prefs.visible}
          aria-label="在角落显示月历"
          onClick={() => store.set({ visible: !prefs.visible })}
          style={switchStyle(prefs.visible)}
        >
          <span aria-hidden="true" style={switchKnobStyle(prefs.visible)} />
        </button>
      </div>

      <div style={rowStyle}>
        <span style={rowTextStyle}>
          <span style={rowTitleStyle}>完整月历</span>
          <span style={rowDescStyle}>整页月历 + 当日一屏（农历、节气、干支、历史上的今天）。</span>
        </span>
        <button
          type="button"
          aria-label="打开完整日历"
          onClick={openFullCalendar}
          style={primaryButtonStyle}
        >
          打开完整日历
        </button>
      </div>
    </section>
  )
}
