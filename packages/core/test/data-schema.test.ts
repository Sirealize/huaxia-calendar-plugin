import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  HEXAGRAM_SKELETONS,
  validateContentPack,
  validateCustomFestival,
  validateHexagram,
  validateHistoricalEvent,
  type ContentPackManifest,
  type CustomFestivalDef,
  type Hexagram,
  type HistoricalEvent,
  type L1ContentPack,
} from '../src/index.ts';

function loadJson<T>(relativePath: string): T {
  const url = new URL(`../src/data/samples/${relativePath}`, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8')) as T;
}

const events = loadJson<HistoricalEvent[]>('historical-events.sample.json');
const hexagrams = loadJson<Hexagram[]>('hexagrams.sample.json');
const festivals = loadJson<CustomFestivalDef[]>('festivals.sample.json');
const manifest = loadJson<ContentPackManifest>('manifest.sample.json');

function daysInMonth(month: number): number {
  return new Date(Date.UTC(2024, month, 0)).getUTCDate();
}

function buildFullSyntheticPack(): L1ContentPack {
  const syntheticEvents: HistoricalEvent[] = [];
  for (let month = 1; month <= 12; month += 1) {
    for (let day = 1; day <= daysInMonth(month); day += 1) {
      syntheticEvents.push({
        id: `he-${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}-001`,
        solar: { month, day },
        eventYear: 1900,
        yearLabel: '1900 年',
        title: '示例标题',
        summary: '这是用于校验与体积测量的代表性摘要文本，长度接近真实文案，仅用于流水线测试。',
        category: 'other',
        region: 'china',
        dateKind: 'exact',
        origin: '中国',
        tags: ['示例'],
        weight: 50,
        source: '原创',
        license: 'self-authored',
      });
    }
  }
  const syntheticHexagrams: Hexagram[] = HEXAGRAM_SKELETONS.map((skeleton) => ({
    id: skeleton.id,
    name: skeleton.name,
    symbol: skeleton.symbol,
    binary: '111111',
    guaCi: '元亨利贞。',
    xiangCi: '天行健，君子以自强不息。',
    yaoCi: ['初九：潜龙勿用。', '九二：见龙在田。', '九三：终日乾乾。', '九四：或跃在渊。', '九五：飞龙在天。', '上九：亢龙有悔。'],
    interpretation: '示例白话解读，用于流水线校验与体积测量。',
    themes: ['示例'],
    source: '《周易》经文（公有领域）',
    license: 'public-domain',
  }));
  return {
    manifest: {
      schemaVersion: '1.0.0',
      packId: 'l1-synthetic',
      packVersion: '0.0.1',
      title: '合成 L1 包（测试用）',
      generatedAt: '2026-11-18T00:00:00+08:00',
      license: 'self-authored',
      counts: {
        historicalEvents: syntheticEvents.length,
        hexagrams: syntheticHexagrams.length,
        festivals: 0,
      },
      coverage: { years: [1900, 2100], dayOfYearCoverage: 'full' },
      files: [],
      attribution: '测试用合成数据',
    },
    historicalEvents: syntheticEvents,
    hexagrams: syntheticHexagrams,
    festivals: [],
  };
}

test('示例内容通过 schema 校验（历史事件/卦象/节日/清单）', () => {
  assert.equal(events.length, 3);
  for (const [i, event] of events.entries()) {
    assert.deepEqual(validateHistoricalEvent(event, `events[${String(i)}]`), []);
  }
  for (const [i, hexagram] of hexagrams.entries()) {
    assert.deepEqual(validateHexagram(hexagram, `hexagrams[${String(i)}]`), []);
  }
  for (const [i, festival] of festivals.entries()) {
    assert.deepEqual(validateCustomFestival(festival, `festivals[${String(i)}]`), []);
  }
  assert.equal(manifest.schemaVersion, '1.0.0');
  assert.equal(manifest.counts.historicalEvents, 3);
});

test('许可证是强制字段：缺 license / license=unknown 均报错', () => {
  const missingLicense = { ...events[0] } as Record<string, unknown>;
  delete missingLicense.license;
  const issues1 = validateHistoricalEvent(missingLicense as unknown as HistoricalEvent);
  assert.ok(issues1.some((i) => i.path.endsWith('.license') && i.severity === 'error'));

  const unknownLicense = { ...events[0], license: 'unknown' } as unknown as HistoricalEvent;
  const issues2 = validateHistoricalEvent(unknownLicense);
  assert.ok(issues2.some((i) => i.message.includes('unknown') && i.severity === 'error'));

  const missingSource = { ...events[0] } as Record<string, unknown>;
  delete missingSource.source;
  const issues3 = validateHistoricalEvent(missingSource as unknown as HistoricalEvent);
  assert.ok(issues3.some((i) => i.path.endsWith('.source') && i.severity === 'error'));
});

test('CC BY-SA 条目缺署名只报 warning（提示必须展示署名后仍可发布）', () => {
  // 注意：本用例**内联构造** CC BY-SA 事件，不依赖 samples 里的条目。
  // 原因：项目已拍板内容只允许 self-authored / public-domain，samples 不得再含 CC BY-SA 内容；
  // 但「CC BY-SA 缺署名 → warning」这条校验分支仍需覆盖，所以在这里显式造一个。
  const ccEvent = { ...events[0], license: 'CC-BY-SA-4.0', source: '外部来源' } as Record<string, unknown>;
  delete ccEvent.attribution;
  const issues = validateHistoricalEvent(ccEvent as unknown as HistoricalEvent);
  assert.ok(issues.some((i) => i.path.endsWith('.attribution') && i.severity === 'warning'));
  assert.ok(!issues.some((i) => i.severity === 'error'));
});

test('完整 L1 内容包（366 条事件 + 64 卦）通过发布闸门', () => {
  const pack = buildFullSyntheticPack();
  assert.equal(pack.historicalEvents.length, 366);
  assert.equal(pack.hexagrams.length, 64);
  const result = validateContentPack(pack);
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
  assert.deepEqual(result.warnings, []);
});

test('64 卦缺一即报错，manifest 计数不一致也报错', () => {
  const pack = buildFullSyntheticPack();
  pack.hexagrams.pop();
  pack.manifest.counts.hexagrams = 64;
  const result = validateContentPack(pack);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((i) => i.path === 'hexagrams' && i.message.includes('64 卦不完整')));
  assert.ok(result.errors.some((i) => i.path === 'manifest.counts.hexagrams'));
});

test('六十四卦骨架：64 个、卦序唯一、符号唯一', () => {
  assert.equal(HEXAGRAM_SKELETONS.length, 64);
  assert.equal(new Set(HEXAGRAM_SKELETONS.map((h) => h.id)).size, 64);
  assert.equal(new Set(HEXAGRAM_SKELETONS.map((h) => h.name)).size, 64);
  assert.equal(new Set(HEXAGRAM_SKELETONS.map((h) => h.symbol)).size, 64);
  assert.equal(HEXAGRAM_SKELETONS[0]?.name, '乾');
  assert.equal(HEXAGRAM_SKELETONS[0]?.symbol, '䷀');
  assert.equal(HEXAGRAM_SKELETONS[63]?.name, '未济');
});
