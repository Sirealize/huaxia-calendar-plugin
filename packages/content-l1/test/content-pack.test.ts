/**
 * L1 内容包发布前闸门测试（node --test）。
 *
 * 覆盖六类发布级要求：
 *   1. 条数 / 日期覆盖 / 每天恰一条 / id 唯一
 *   2. 逐条 schema 校验（@shishu/core 的 validateHistoricalEvent）
 *   3. 许可证白名单（只允许 self-authored / public-domain）
 *   4. summary 60–140 字、title 8–20 字
 *   5. manifest 计数 / 文件字节数 / sha256 与数据文件实测值一致
 *   6. validateContentPack / assertContentPack 发布闸门
 *
 * M0′ 范围说明：本包暂不含卦象（F08 不在 M0′ 范围）。@shishu/core 的
 * validateContentPack 对完整 L1 包硬性要求 64 卦，因此这里对 pack 级 errors
 * 做**精确断言**：必须恰好 1 条，且只能是「hexagrams 64 卦不完整」。
 * 这条断言是哨兵——将来补上卦象后它会主动失败，提醒同步更新测试。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  assertContentPack,
  validateContentPack,
  validateHistoricalEvent,
  type HistoricalEvent,
  type L1ContentPack,
} from '@shishu/core';
import { historicalEvents, packManifest } from '../src/index.ts';

/** 任务口径：公历 11-18 至 12-17，恰好 30 天。 */
const COVERAGE_START_UTC = Date.UTC(2026, 10, 18); // 年份仅用于日期序列推算，不影响月日
const COVERAGE_DAYS = 30;
const DAY_MS = 86_400_000;

const ALLOWED_LICENSES = new Set<string>(['self-authored', 'public-domain']);
const ALLOWED_SOURCES = new Set<string>(['原创整理']);
const CATEGORIES = new Set<string>([
  'political',
  'military',
  'culture',
  'science',
  'technology',
  'economy',
  'society',
  'life',
  'disaster',
  'sports',
  'other',
]);

const DATA_FILE = new URL('../src/data/historical-events.json', import.meta.url);

function dateKey(event: HistoricalEvent): string {
  return `${String(event.solar.month)}-${String(event.solar.day)}`;
}

function expectedDateKeys(): string[] {
  return Array.from({ length: COVERAGE_DAYS }, (_, index) => {
    const date = new Date(COVERAGE_START_UTC + index * DAY_MS);
    return `${String(date.getUTCMonth() + 1)}-${String(date.getUTCDate())}`;
  });
}

/** 按 Unicode 码点计字（中文标点计 1 字，与「字」的口径一致）。 */
function charLength(value: string): number {
  return Array.from(value).length;
}

/** 不含卦象的 M0′ 内容包（hexagrams 空数组为既定范围，不是遗漏）。 */
const pack: L1ContentPack = {
  manifest: packManifest,
  historicalEvents,
  hexagrams: [],
  festivals: [],
};

test('恰含 30 条，覆盖 11-18 至 12-17，每天恰一条，id 与日期一致', () => {
  assert.equal(historicalEvents.length, COVERAGE_DAYS);

  const ids = historicalEvents.map((event) => event.id);
  assert.equal(new Set(ids).size, COVERAGE_DAYS, 'id 必须全局唯一');

  const keys = historicalEvents.map(dateKey);
  assert.equal(new Set(keys).size, COVERAGE_DAYS, '同一公历月日不得有多条');

  const expected = expectedDateKeys();
  assert.deepEqual([...keys].sort(), [...expected].sort(), '必须覆盖 11-18 至 12-17 连续 30 天');

  for (const event of historicalEvents) {
    const expectedId = `he-${String(event.solar.month).padStart(2, '0')}${String(event.solar.day).padStart(2, '0')}-001`;
    assert.equal(event.id, expectedId, `${event.id} 与 solar 月日不匹配`);
  }
});

test('30 条逐条通过 schema 校验（validateHistoricalEvent 零 issue）', () => {
  for (const [index, event] of historicalEvents.entries()) {
    const issues = validateHistoricalEvent(event, `historicalEvents[${String(index)}]`);
    assert.deepEqual(issues, [], `${event.id} schema 校验失败`);
  }
});

test('许可证白名单：全部 self-authored / public-domain，且来源与溯源字段齐全', () => {
  for (const event of historicalEvents) {
    assert.ok(ALLOWED_LICENSES.has(event.license), `${event.id} license=${event.license} 不在白名单`);
    assert.ok(!String(event.license).includes('CC-BY-SA'), `${event.id} 出现 CC BY-SA（禁止）`);
    assert.ok(ALLOWED_SOURCES.has(event.source), `${event.id} source 必须是「原创整理」（收到 ${event.source}）`);
    assert.match(event.retrievedAt ?? '', /^\d{4}-\d{2}-\d{2}$/, `${event.id} retrievedAt 必须是 ISO 日期`);
    assert.ok(CATEGORIES.has(event.category), `${event.id} category=${event.category} 非法`);
    assert.ok(
      Array.isArray(event.tags) && event.tags.length >= 2 && event.tags.length <= 5,
      `${event.id} tags 必须 2-5 个`,
    );
    assert.ok(
      typeof event.weight === 'number' && event.weight >= 0 && event.weight <= 100,
      `${event.id} weight 必须是 0-100`,
    );
  }
});

test('summary 60–140 字、title 8–20 字、yearLabel 与 eventYear 一致', () => {
  for (const event of historicalEvents) {
    const summaryLength = charLength(event.summary);
    assert.ok(summaryLength >= 60 && summaryLength <= 140, `${event.id} summary ${String(summaryLength)} 字（要求 60-140）`);

    const titleLength = charLength(event.title);
    assert.ok(titleLength >= 8 && titleLength <= 20, `${event.id} title ${String(titleLength)} 字（要求 8-20）`);

    assert.equal(event.yearLabel, `${String(event.eventYear)} 年`, `${event.id} yearLabel 与 eventYear 不一致`);
  }
});

test('manifest 计数 / 版本 / 许可 / 署名与数据一致', () => {
  assert.equal(packManifest.schemaVersion, '1.0.0');
  assert.equal(packManifest.packVersion, '0.1.0-m0.0');
  assert.equal(packManifest.license, 'self-authored');
  assert.equal(packManifest.counts.historicalEvents, COVERAGE_DAYS);
  assert.equal(packManifest.counts.hexagrams, 0, 'M0′ 不含卦象，计数必须为 0');
  assert.equal(packManifest.counts.festivals, 0);
  assert.equal(packManifest.files.length, 1);
  assert.equal(packManifest.files[0]?.path, 'data/historical-events.json');
  assert.equal(packManifest.files[0]?.recordCount, COVERAGE_DAYS);
  assert.ok(packManifest.attribution.includes('self-authored'), 'manifest 必须声明 self-authored 署名');
  assert.ok(!packManifest.attribution.includes('维基'), 'manifest 署名不得指向维基百科');
});

test('manifest.files 的 bytes / sha256 与数据文件实测值一致（禁止手填）', () => {
  const raw = readFileSync(DATA_FILE);
  const entry = packManifest.files[0];
  assert.ok(entry !== undefined, 'manifest.files[0] 缺失');
  assert.equal(entry.bytes, raw.byteLength, '文件字节数与实测不一致，请跑 npm run build:manifest');
  assert.equal(
    entry.sha256,
    createHash('sha256').update(raw).digest('hex'),
    'sha256 与实测不一致，请跑 npm run build:manifest',
  );
});

test('validateContentPack：M0′ 包恰好只有 1 条 error，且只能是既定卦象缺口', () => {
  const result = validateContentPack(pack);

  // 精确断言：将来补卦象或引入其它问题时，这条会主动失败。
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, [
    { path: 'hexagrams', message: '64 卦不完整：实际 0 卦', severity: 'error' },
  ]);

  // 除「未覆盖日期」以外的 warning 也不该出现（license 等字段必须在上面各测试中已清零）。
  const unexpectedWarnings = result.warnings.filter(
    (warning) => !(warning.path === 'historicalEvents' && warning.message.includes('没有历史事件')),
  );
  assert.deepEqual(unexpectedWarnings, []);
});

test('assertContentPack 发布闸门：仅因不含卦象抛错，报错不得混入历史事件条目问题', () => {
  assert.throws(
    () => {
      assertContentPack(pack);
    },
    (error: unknown): boolean => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /内容包校验失败/);
      assert.match(error.message, /hexagrams: 64 卦不完整/);
      assert.doesNotMatch(error.message, /historicalEvents\[/, '历史事件条目本身不得有 error');
      return true;
    },
  );
});
