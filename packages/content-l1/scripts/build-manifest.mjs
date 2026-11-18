/**
 * 生成 `src/data/manifest.json` 的构建脚本。
 *
 * 为什么用脚本而不是手填：manifest 里的 `files[].bytes` / `files[].sha256`
 * 必须与数据文件逐字节一致。手填会在内容改动后悄悄失真，而 sha256 是内容包
 * 完整性校验与「内容是否被篡改」审计的唯一依据。
 *
 * 用法：node scripts/build-manifest.mjs
 * 可复现：除 `generatedAt` 保留既有值（可用 PACK_GENERATED_AT 覆盖）外，
 * 其余字段完全由 `historical-events.json` 推导，重复运行结果一致。
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACK_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_PATH = 'src/data/historical-events.json';
const MANIFEST_PATH = 'src/data/manifest.json';

const dataBytes = readFileSync(join(PACK_ROOT, DATA_PATH));
const events = JSON.parse(dataBytes.toString('utf8'));
if (!Array.isArray(events) || events.length === 0) {
  throw new Error(`[build-manifest] ${DATA_PATH} 必须是非空数组`);
}

const previous = JSON.parse(readFileSync(join(PACK_ROOT, MANIFEST_PATH), 'utf8'));

const manifest = {
  schemaVersion: '1.0.0',
  packId: previous.packId ?? 'shishu-l1-30d',
  packVersion: '0.1.0-m0.0',
  title: previous.title ?? '华夏文明日历 · 30 天文明史样板',
  generatedAt: process.env.PACK_GENERATED_AT ?? previous.generatedAt ?? new Date().toISOString(),
  license: 'self-authored',
  counts: {
    historicalEvents: events.length,
    hexagrams: 0,
    festivals: 0,
  },
  coverage: {
    years: [1900, 2100],
    dayOfYearCoverage: 'partial',
  },
  files: [
    {
      // 相对本包 `src/` 目录（与 index.ts 的 JSON 导入路径一致）
      path: 'data/historical-events.json',
      bytes: dataBytes.length,
      sha256: createHash('sha256').update(dataBytes).digest('hex'),
      recordCount: events.length,
    },
  ],
  attribution:
    '本内容包全部条目为原创整理（self-authored），叙述文字为原创；所述年份均为公开可核实的史实，不随包分发任何第三方百科正文。',
};

writeFileSync(join(PACK_ROOT, MANIFEST_PATH), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(
  `[build-manifest] ${events.length} 条事件 → ${MANIFEST_PATH}：` +
    `${dataBytes.length} bytes，sha256=${manifest.files[0].sha256}`,
);
