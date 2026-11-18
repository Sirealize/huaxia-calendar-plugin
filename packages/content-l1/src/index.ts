/**
 * @shishu/content-l1 —— L1 内容包（30 天文明史叙事样板）
 *
 * 契约（M0′ 起稳定，UI 与宿主只依赖这三样）：
 *   - `packManifest`：内容包元数据（类型即 @shishu/core 的 ContentPackManifest）
 *   - `historicalEvents`：全部条目（类型即 @shishu/core 的 HistoricalEvent）
 *   - `getEventForDate(month, day)`：按公历月日取一条（当天无条目返回 undefined）
 *
 * 许可证铁律：本包只允许 `self-authored` / `public-domain`。
 * 任何 CC-BY-SA 条目都会让整个内容包被 ShareAlike 传染，发布前由 validateContentPack 阻断。
 *
 * 注意：`packManifest` 直接读取 `src/data/manifest.json`（由 `scripts/build-manifest.mjs`
 * 依据数据文件真实字节数与 sha256 生成），避免手写常量与数据文件不同步。
 */
import type { ContentPackManifest, HistoricalEvent } from '@shishu/core'
import events from './data/historical-events.json' with { type: 'json' }
import manifest from './data/manifest.json' with { type: 'json' }

export const historicalEvents = events as HistoricalEvent[]

export const packManifest = manifest as ContentPackManifest

const byDate = new Map<string, HistoricalEvent>()
for (const event of historicalEvents) {
  const key = `${event.solar.month}-${event.solar.day}`
  const prev = byDate.get(key)
  if (!prev || (event.weight ?? 0) > (prev.weight ?? 0)) byDate.set(key, event)
}

/** 按公历月日取当天权重最高的一条；无条目返回 undefined（UI 必须优雅降级）。 */
export function getEventForDate(month: number, day: number): HistoricalEvent | undefined {
  return byDate.get(`${month}-${day}`)
}
