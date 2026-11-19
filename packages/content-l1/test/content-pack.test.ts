/**
 * L1 内容包发布前闸门测试（node --test）。
 *
 * v0.3.0-A 起，内容定位从「每天一条、偏西方」改为
 * **「每天 3 条轮播：以中华文明为主体，兼及古今中外」**。本测试即该定位的硬约束：
 *
 *   1. 条数 / 日期覆盖 / 每天恰 3 条 / id 与月日序号一致
 *   2. 配比铁律：每天 ≥2 条 china、≤1 条 world；全包中国占比 ≥ 2/3
 *   3. 世界条目多样性：欧美日印阿波斯非拉美东南亚都要有，美国题材全包 ≤5 条
 *   4. 古今平衡：中国古代（先秦—清）≥30 条，1840 年后近现代 ≤40 条
 *   5. 日期口径（dateKind）：exact = 确为当日的「历史上的今天」，period = 只以年份+
 *      朝代入档的文明坐标；exact ≥30、period ≥40、每天 ≥1 条 exact
 *   6. 日期口径自洽：exact 条目 summary 必须写明当日日期；period 条目 summary 不得
 *      出现公历月日表述（不许把文明坐标谎称「今天」）
 *   7. 逐条 schema 校验（@shishu/core 的 validateHistoricalEvent）+ region/origin/dateKind 必填
 *   8. 许可证白名单（只允许 self-authored / public-domain）
 *   9. summary 60–140 字、title 8–20 字、yearLabel 与 eventYear 一致（含公元前）
 *  10. getEventsForDate 排序语义（china 优先 → weight 降序 → 年份升序）、getEventForDate 取第一条
 *  11. manifest 计数 / 文件字节数 / sha256 与数据文件实测值一致
 *  12. validateContentPack / assertContentPack 发布闸门
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
import {
  getEventForDate,
  getEventsForDate,
  historicalEvents,
  packManifest,
} from '../src/index.ts';

/** 任务口径：公历 11-18 至 12-17，恰好 30 天，每天 3 条。 */
const COVERAGE_START_UTC = Date.UTC(2026, 10, 18); // 年份仅用于日期序列推算，不影响月日
const COVERAGE_DAYS = 30;
const EVENTS_PER_DAY = 3;
const TOTAL_EVENTS = COVERAGE_DAYS * EVENTS_PER_DAY;
const DAY_MS = 86_400_000;

/** 配比铁律（与 docs/content-review-checklist.md「选题配比」一节一致）。 */
/** 古代 / 近现代的分界年：1840 年（鸦片战争）。 */
const MODERN_START_YEAR = 1840;
/** 每天至少 2 条中华文明条目。 */
const MIN_CHINA_PER_DAY = 2;
/** 每天至多 1 条世界条目。 */
const MAX_WORLD_PER_DAY = 1;
/** 全包中国条目占比下限：2/3。 */
const MIN_CHINA_RATIO_NUMERATOR = 2;
const MIN_CHINA_RATIO_DENOMINATOR = 3;
/** 中国古代（先秦—清）条目下限。 */
const MIN_CHINA_ANCIENT = 30;
/** 1840 年后近现代条目上限。 */
const MAX_MODERN = 40;
/** 30 条世界条目里美国题材上限。 */
const MAX_US_WORLD = 5;
/** 日期口径：`exact` = 确为当日的「历史上的今天」；`period` = 只以年份+朝代入档的文明坐标。 */
const ALLOWED_DATE_KINDS = new Set<string>(['exact', 'period']);
/** exact 条目下限（「历史上的今天」的可信度来源）。 */
const MIN_EXACT_EVENTS = 30;
/** period 条目下限（文明坐标必须真的存在，否则又退回「只有近现代」）。 */
const MIN_PERIOD_EVENTS = 40;
/** 公历「X 月 X 日」表述（阿拉伯数字或中文数字），用于校验 period 条目不许出现日历日期。 */
const CALENDAR_DATE_RE = /(?:\d{1,2}|[一二三四五六七八九十]{1,3})\s*月\s*(?:\d{1,2}|[一二三四五六七八九十]{1,3})\s*日/;
/** 世界条目必须覆盖的地域板块（origin 前缀）。 */
const REQUIRED_WORLD_ORIGIN_AREAS = [
  '欧洲',
  '亚洲',
  '南亚',
  '非洲',
  '拉美',
  '东南亚',
  '大洋洲',
  '阿拉伯',
];

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

/** 依宪法（公元前用「公元前 N 年」）推导 yearLabel。 */
function expectedYearLabel(eventYear: number): string {
  return eventYear < 0 ? `公元前 ${String(-eventYear)} 年` : `${String(eventYear)} 年`;
}

/** 按 Unicode 码点计字（中文标点计 1 字，与「字」的口径一致）。 */
function charLength(value: string): number {
  return Array.from(value).length;
}

function regionOf(event: HistoricalEvent): 'china' | 'world' {
  return event.region === 'world' ? 'world' : 'china';
}

function isAncient(event: HistoricalEvent): boolean {
  return event.eventYear < MODERN_START_YEAR;
}

/** 世界条目里的「美国题材」判定（origin 或 summary 指向美国）。 */
function isUsTopic(event: HistoricalEvent): boolean {
  return String(event.origin ?? '').includes('美国') || event.summary.includes('美国');
}

/** 不含卦象的 M0′ 内容包（hexagrams 空数组为既定范围，不是遗漏）。 */
const pack: L1ContentPack = {
  manifest: packManifest,
  historicalEvents,
  hexagrams: [],
  festivals: [],
};

test('恰含 90 条，覆盖 11-18 至 12-17，每天恰 3 条，id 与月日序号一致', () => {
  assert.equal(historicalEvents.length, TOTAL_EVENTS);

  const ids = historicalEvents.map((event) => event.id);
  assert.equal(new Set(ids).size, TOTAL_EVENTS, 'id 必须全局唯一');

  const expected = expectedDateKeys();
  const perDay = new Map<string, number>();
  for (const event of historicalEvents) {
    const key = dateKey(event);
    perDay.set(key, (perDay.get(key) ?? 0) + 1);
  }
  assert.deepEqual([...perDay.keys()].sort(), [...expected].sort(), '必须覆盖 11-18 至 12-17 连续 30 天');
  for (const [key, count] of perDay) {
    assert.equal(count, EVENTS_PER_DAY, `${key} 应恰有 ${String(EVENTS_PER_DAY)} 条（收到 ${String(count)}）`);
  }

  // id 规则：he-<MMDD>-<序号>，同日序号恰为 001/002/003，且与 solar 一致。
  const byDay = new Map<string, HistoricalEvent[]>();
  for (const event of historicalEvents) {
    const key = dateKey(event);
    byDay.set(key, [...(byDay.get(key) ?? []), event]);
  }
  for (const [key, list] of byDay) {
    const [month, day] = key.split('-').map(Number);
    const prefix = `he-${String(month ?? 0).padStart(2, '0')}${String(day ?? 0).padStart(2, '0')}`;
    const suffixes = list.map((event) => event.id.slice(prefix.length + 1)).sort();
    assert.deepEqual(suffixes, ['001', '002', '003'], `${key} 的 id 序号必须是 001/002/003`);
    for (const event of list) {
      assert.ok(event.id.startsWith(`${prefix}-`), `${event.id} 与 solar 月日不匹配`);
    }
  }
});

test('配比铁律：每天 ≥2 条中华、≤1 条世界；全包中国占比 ≥ 2/3', () => {
  const byDay = new Map<string, HistoricalEvent[]>();
  for (const event of historicalEvents) {
    const key = dateKey(event);
    byDay.set(key, [...(byDay.get(key) ?? []), event]);
  }

  for (const [key, list] of byDay) {
    const china = list.filter((event) => regionOf(event) === 'china').length;
    const world = list.filter((event) => regionOf(event) === 'world').length;
    assert.ok(china >= MIN_CHINA_PER_DAY, `${key} 中华条目 ${String(china)} 条，少于 ${String(MIN_CHINA_PER_DAY)} 条`);
    assert.ok(world <= MAX_WORLD_PER_DAY, `${key} 世界条目 ${String(world)} 条，多于 ${String(MAX_WORLD_PER_DAY)} 条`);
    assert.equal(china + world, list.length, `${key} 存在既非 china 也非 world 的条目`);
  }

  const chinaTotal = historicalEvents.filter((event) => regionOf(event) === 'china').length;
  assert.ok(
    chinaTotal * MIN_CHINA_RATIO_DENOMINATOR >= historicalEvents.length * MIN_CHINA_RATIO_NUMERATOR,
    `中国条目 ${String(chinaTotal)}/${String(historicalEvents.length)}，未达 2/3`,
  );
});

test('世界条目多样性：覆盖各大地域板块，美国题材全包 ≤5 条', () => {
  const worldEvents = historicalEvents.filter((event) => regionOf(event) === 'world');
  assert.equal(worldEvents.length, 30, '世界条目应恰为 30 条（每天 1 条）');

  const areas = [...new Set(worldEvents.map((event) => String(event.origin ?? '').split('·')[0]))];
  for (const area of REQUIRED_WORLD_ORIGIN_AREAS) {
    assert.ok(areas.includes(area), `世界条目缺少「${area}」板块，现有：${areas.join('、')}`);
  }

  const usTopics = worldEvents.filter((event) => isUsTopic(event));
  assert.ok(
    usTopics.length <= MAX_US_WORLD,
    `世界条目里美国题材 ${String(usTopics.length)} 条，超过上限 ${String(MAX_US_WORLD)}：` +
      usTopics.map((event) => event.id).join('、'),
  );
});

test('古今平衡：中国先秦—清条目 ≥30 条，1840 年后近现代条目 ≤40 条', () => {
  const chinaAncient = historicalEvents.filter((event) => regionOf(event) === 'china' && isAncient(event));
  assert.ok(
    chinaAncient.length >= MIN_CHINA_ANCIENT,
    `中国古代条目仅 ${String(chinaAncient.length)} 条，少于 ${String(MIN_CHINA_ANCIENT)} 条`,
  );

  const modern = historicalEvents.filter((event) => !isAncient(event));
  assert.ok(
    modern.length <= MAX_MODERN,
    `1840 年后近现代条目 ${String(modern.length)} 条，超过上限 ${String(MAX_MODERN)} 条`,
  );
});

test('日期口径 dateKind：每条显式标注且合法；exact ≥30、period ≥40；每天至少 1 条 exact', () => {
  for (const event of historicalEvents) {
    assert.ok(
      ALLOWED_DATE_KINDS.has(String(event.dateKind)),
      `${event.id} dateKind 必须显式填写 exact 或 period（收到 ${String(event.dateKind)}）`,
    );
  }

  const exact = historicalEvents.filter((event) => event.dateKind === 'exact');
  const period = historicalEvents.filter((event) => event.dateKind === 'period');
  assert.ok(exact.length >= MIN_EXACT_EVENTS, `exact 条目仅 ${String(exact.length)} 条，少于 ${String(MIN_EXACT_EVENTS)} 条`);
  assert.ok(period.length >= MIN_PERIOD_EVENTS, `period 条目仅 ${String(period.length)} 条，少于 ${String(MIN_PERIOD_EVENTS)} 条`);
  assert.equal(exact.length + period.length, historicalEvents.length, 'dateKind 必须恰好二分');

  // 「历史上的今天」的可信度来源：每天至少 1 条确为当日的事件。
  // 若某天确实找不到真实同日事件，允许该天为 0，但必须在内容评审汇报里列明是哪几天（不得靠编日期凑数）。
  const byDay = new Map<string, HistoricalEvent[]>();
  for (const event of historicalEvents) {
    const key = dateKey(event);
    byDay.set(key, [...(byDay.get(key) ?? []), event]);
  }
  for (const key of expectedDateKeys()) {
    const list = byDay.get(key) ?? [];
    const exactCount = list.filter((event) => event.dateKind === 'exact').length;
    assert.ok(exactCount >= 1, `${key} 没有任何 exact 条目（当天没有「历史上的今天」事件）`);
  }
});

test('日期口径自洽：exact 条目 summary 写明当日日期，period 条目 summary 不得出现公历月日', () => {
  for (const event of historicalEvents) {
    const solarDate = `${String(event.solar.month)} 月 ${String(event.solar.day)} 日`;
    if (event.dateKind === 'exact') {
      assert.ok(
        event.summary.includes(solarDate),
        `${event.id} 为 exact 条目，summary 必须写明「${solarDate}」以支撑「历史上的今天」`,
      );
    } else {
      const hit = CALENDAR_DATE_RE.exec(event.summary);
      assert.equal(
        hit,
        null,
        `${event.id} 为 period 条目，summary 不得出现公历月日表述（命中「${hit?.[0] ?? ''}」）；` +
          'period 只是文明坐标，不得谎称发生在当天',
      );
    }
  }
});

test('region / origin 必填且取值合法；逐条通过 schema 校验（零 issue）', () => {
  for (const [index, event] of historicalEvents.entries()) {
    assert.ok(
      event.region === 'china' || event.region === 'world',
      `${event.id} region 必须显式填写 china 或 world（收到 ${String(event.region)}）`,
    );
    assert.equal(typeof event.origin, 'string', `${event.id} origin 必须填写`);
    assert.ok((event.origin ?? '').length > 0, `${event.id} origin 不得为空`);
    assert.ok((event.origin ?? '').includes('·'), `${event.id} origin 应写成「中国·北宋」「欧洲·意大利」这种带时期/地域的格式`);

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

    assert.equal(event.yearLabel, expectedYearLabel(event.eventYear), `${event.id} yearLabel 与 eventYear 不一致`);
    assert.notEqual(event.eventYear, 0, `${event.id} eventYear 不得为 0`);
  }
});

test('getEventsForDate：返回当天 3 条，china 在前，再按 weight 降序、年份升序', () => {
  for (const key of expectedDateKeys()) {
    const [month, day] = key.split('-').map(Number);
    const list = getEventsForDate(month ?? 0, day ?? 0);
    assert.equal(list.length, EVENTS_PER_DAY, `${key} getEventsForDate 应返回 3 条`);

    // 中华条目（2 条）必在世界条目之前
    assert.deepEqual(
      list.map((event) => regionOf(event)),
      ['china', 'china', 'world'],
      `${key} 排序应为「中华、中华、世界」`,
    );

    for (let i = 1; i < list.length; i += 1) {
      const prev = list[i - 1];
      const current = list[i];
      assert.ok(prev !== undefined && current !== undefined);
      const prevRegion = prev.region === 'world' ? 1 : 0;
      const currentRegion = current.region === 'world' ? 1 : 0;
      if (prevRegion !== currentRegion) {
        assert.ok(prevRegion < currentRegion, `${key} 中华条目必须排在世界条目前`);
        continue;
      }
      const weightDiff = (current.weight ?? 0) - (prev.weight ?? 0);
      assert.ok(weightDiff <= 0, `${key} 同区条目须按 weight 降序（${prev.id} → ${current.id}）`);
      if (weightDiff === 0) {
        assert.ok(prev.eventYear <= current.eventYear, `${key} weight 相同须按年份升序（${prev.id} → ${current.id}）`);
      }
    }
  }
});

test('getEventForDate：返回当天排序后的第一条；无条目日期返回 undefined', () => {
  for (const key of expectedDateKeys()) {
    const [month, day] = key.split('-').map(Number);
    const first = getEventForDate(month ?? 0, day ?? 0);
    assert.ok(first !== undefined, `${key} 应有一条`);
    assert.equal(first.id, getEventsForDate(month ?? 0, day ?? 0)[0]?.id, `${key} getEventForDate 必须取第一条`);
    assert.equal(first.region, 'china', `${key} 第一条应为中华文明条目`);
  }
  assert.equal(getEventForDate(2, 30), undefined, '无条目日期应返回 undefined');
  assert.deepEqual(getEventsForDate(2, 30), [], '无条目日期应返回空数组');
});

test('manifest 计数 / 版本 / 许可 / 署名与数据一致', () => {
  assert.equal(packManifest.schemaVersion, '1.0.0');
  assert.equal(packManifest.packVersion, '0.1.0-m0.0');
  assert.equal(packManifest.license, 'self-authored');
  assert.equal(packManifest.counts.historicalEvents, TOTAL_EVENTS);
  assert.equal(packManifest.counts.hexagrams, 0, 'M0′ 不含卦象，计数必须为 0');
  assert.equal(packManifest.counts.festivals, 0);
  assert.equal(packManifest.files.length, 1);
  assert.equal(packManifest.files[0]?.path, 'data/historical-events.json');
  assert.equal(packManifest.files[0]?.recordCount, TOTAL_EVENTS);
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
