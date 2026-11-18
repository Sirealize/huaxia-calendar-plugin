/**
 * L1 内容包序列化体积实测。
 *
 * 运行：
 *   node scripts/estimate-content-size.ts
 *   node scripts/estimate-content-size.ts /path/to/real-pack-dir   # 可选：测量真实数据包
 *
 * 无参数时生成「366 条历史事件 + 64 卦 + 10 条自定义节日」的**占位文本**内容包：
 * - 字段结构、字段数量与真实包完全一致；
 * - 文本长度按真实文案分布抽样（标题 8-16 字、摘要 90-130 字、解读 100-160 字）；
 * - 占位文本使用随机常用汉字，gzip 压缩率低于真实文案，因此 gzip 数字是**保守上界**。
 *
 * 真实包目录约定文件：historical-events.json / hexagrams.json / festivals.json。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import {
  CONTENT_SCHEMA_VERSION,
  HEXAGRAM_SKELETONS,
  validateContentPack,
  type ContentPackManifest,
  type CustomFestivalDef,
  type Hexagram,
  type HistoricalEvent,
  type L1ContentPack,
} from '../src/index.ts';

const COMMON_CHARS =
  '的一是在不了有和人这中大为上个国我以要他时来用们生到作地于出就分对成会可主发年动同工也能下过子说产种面而方后多定行学法所民得经十三之进着等部度家电力里如水化高自二理起小物现实加量都两体制机当使点从业本去把性好应开它合还因由其些然前外天政四日那社义事平形相全表间样与关各重新线内数正心反你明看原又么利比或但质气第向道命此变条只没结解问意建月公无系军很情者最立代想已通并提直题党程展五果料象员革位入常文总次品式活设及管特件长求老头基资边流路级少图山统接知较将组见计别她手角期根论运农指几九区强放决西被干做必战先回则任取据处队南给色光门即保治北造百规热领七海口东导器压志世金增争济阶油思术极交受联什认六共权收证改清己美再采转更单风切打白教速花带安场身车例真务具万每目至达走积示议声报斗完类八离华名确才科张信马节话米整空元况今集温传土许步群广石记需段研界拉林律叫且究观越织装影算低持音众书布复容儿须际商非验连断深难近矿千周委素技备半办青省列习响约支般史感劳便团往酸历市克何除消构府称太准精值号率族维划选标写存候毛亲快效斯院查江型眼王按格养易置派层片始却专状育厂京识适属圆包火住调满县局照参红细引听该铁价严';

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function randomChars(rng: () => number, length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += COMMON_CHARS[Math.floor(rng() * COMMON_CHARS.length)] as string;
  }
  return out;
}

function randomInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function randomOf<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)] as T;
}

function daysInMonth(month: number): number {
  return new Date(Date.UTC(2024, month, 0)).getUTCDate();
}

function buildSyntheticEvents(withOptionalFields: boolean): HistoricalEvent[] {
  const rng = createRng(20260217);
  const tagsPool = ['开国', '战争', '科技', '文学', '改革', '外交', '灾害', '考古', '航天', '民生', '制度', '艺术'];
  const events: HistoricalEvent[] = [];
  for (let month = 1; month <= 12; month += 1) {
    for (let day = 1; day <= daysInMonth(month); day += 1) {
      const eventYear = randomInt(rng, 1, 2025);
      const event: HistoricalEvent = {
        id: `he-${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}-001`,
        solar: { month, day },
        eventYear,
        yearLabel: `${String(eventYear)} 年`,
        title: randomChars(rng, randomInt(rng, 8, 16)),
        summary: randomChars(rng, randomInt(rng, 90, 130)),
        category: 'other',
        tags: Array.from({ length: randomInt(rng, 2, 4) }, () => randomOf(rng, tagsPool)),
        weight: randomInt(rng, 20, 100),
        source: '合成测量数据',
        license: 'self-authored',
      };
      if (withOptionalFields) {
        event.sourceUrl = `https://example.invalid/synthetic/${String(month)}_${String(day)}`;
        event.attribution = '体积测量用合成数据，非真实内容';
        event.retrievedAt = '2026-11-18';
      }
      events.push(event);
    }
  }
  return events;
}

function buildSyntheticHexagrams(): Hexagram[] {
  const rng = createRng(0x5a5a);
  const themesPool = ['刚健', '柔顺', '进取', '守成', '变革', '险阻', '光明', '谦退', '聚合', '决断'];
  return HEXAGRAM_SKELETONS.map((skeleton) => ({
    id: skeleton.id,
    name: skeleton.name,
    symbol: skeleton.symbol,
    binary: '111111',
    lowerTrigram: '乾',
    upperTrigram: '乾',
    guaCi: randomChars(rng, randomInt(rng, 8, 36)),
    tuanCi: randomChars(rng, randomInt(rng, 30, 60)),
    xiangCi: randomChars(rng, randomInt(rng, 15, 30)),
    yaoCi: Array.from({ length: 6 }, () => randomChars(rng, randomInt(rng, 15, 35))),
    yongCi: skeleton.id <= 2 ? randomChars(rng, randomInt(rng, 10, 20)) : undefined,
    interpretation: randomChars(rng, randomInt(rng, 100, 160)),
    themes: Array.from({ length: randomInt(rng, 2, 4) }, () => randomOf(rng, themesPool)),
    source: '《周易》经文（公有领域）',
    license: 'public-domain',
  }));
}

function buildSyntheticFestivals(): CustomFestivalDef[] {
  const rng = createRng(42);
  const defs: CustomFestivalDef[] = [];
  for (let i = 0; i < 10; i += 1) {
    defs.push({
      id: `custom-festival-${String(i + 1)}`,
      name: randomChars(rng, randomInt(rng, 2, 5)),
      rule: { kind: 'solar-fixed', month: randomInt(rng, 1, 12), day: randomInt(rng, 1, 28) },
      category: '自定义节日',
      description: randomChars(rng, randomInt(rng, 20, 40)),
      source: '原创',
      license: 'self-authored',
    });
  }
  return defs;
}

function buildManifest(pack: {
  events: HistoricalEvent[];
  hexagrams: Hexagram[];
  festivals: CustomFestivalDef[];
}): ContentPackManifest {
  return {
    schemaVersion: CONTENT_SCHEMA_VERSION,
    packId: 'l1-size-estimate',
    packVersion: '0.0.1',
    title: 'L1 体积测量用内容包',
    generatedAt: '2026-11-18T00:00:00+08:00',
    license: 'self-authored',
    counts: {
      historicalEvents: pack.events.length,
      hexagrams: pack.hexagrams.length,
      festivals: pack.festivals.length,
    },
    coverage: { years: [1900, 2100], dayOfYearCoverage: 'full' },
    files: [],
    attribution: '体积测量用合成数据，不含任何真实内容或外部来源。',
  };
}

function bytesOf(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

function gzipBytesOf(value: unknown): number {
  return gzipSync(Buffer.from(JSON.stringify(value), 'utf8'), { level: 9 }).length;
}

function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function reportPack(label: string, pack: L1ContentPack): void {
  const eventsBytes = bytesOf(pack.historicalEvents);
  const hexBytes = bytesOf(pack.hexagrams);
  const festivalBytes = bytesOf(pack.festivals);
  const totalBytes = bytesOf(pack);
  console.log(`\n== ${label} ==`);
  console.log('文件/数组 | 条数 | JSON 紧凑 | gzip -9 | 单条平均(JSON)');
  console.log('--- | ---: | ---: | ---: | ---:');
  const row = (name: string, count: number, bytes: number, gz: number): void => {
    console.log(
      `${name} | ${String(count)} | ${kb(bytes)} (${String(bytes)} B) | ${kb(gz)} | ` +
        `${count > 0 ? `${(bytes / count).toFixed(0)} B` : '-'}`,
    );
  };
  row('historical-events', pack.historicalEvents.length, eventsBytes, gzipBytesOf(pack.historicalEvents));
  row('hexagrams', pack.hexagrams.length, hexBytes, gzipBytesOf(pack.hexagrams));
  row('festivals', pack.festivals.length, festivalBytes, gzipBytesOf(pack.festivals));
  row('manifest', 1, bytesOf(pack.manifest), gzipBytesOf(pack.manifest));
  row('整包（不含 manifest）', pack.historicalEvents.length, totalBytes - bytesOf(pack.manifest), 0);
  const totalGzip = gzipBytesOf(pack);
  console.log(
    `整包（含 manifest）JSON 紧凑: ${kb(totalBytes)} (${String(totalBytes)} B)，gzip -9: ${kb(totalGzip)} (${String(totalGzip)} B)`,
  );
}

function main(): void {
  const realDir = process.argv[2];
  console.log('== @shishu/core L1 内容包体积实测 ==');
  console.log(`环境: node ${process.version} / ${process.platform} ${process.arch}`);

  if (realDir !== undefined) {
    const events = JSON.parse(readFileSync(join(realDir, 'historical-events.json'), 'utf8')) as HistoricalEvent[];
    const hexagrams = JSON.parse(readFileSync(join(realDir, 'hexagrams.json'), 'utf8')) as Hexagram[];
    const festivals = JSON.parse(readFileSync(join(realDir, 'festivals.json'), 'utf8')) as CustomFestivalDef[];
    const pack: L1ContentPack = {
      manifest: buildManifest({ events, hexagrams, festivals }),
      historicalEvents: events,
      hexagrams,
      festivals,
    };
    const result = validateContentPack(pack);
    console.log(`schema 校验: ${result.ok ? '通过' : '失败'}（errors=${String(result.errors.length)}, warnings=${String(result.warnings.length)}）`);
    reportPack(`真实内容包：${realDir}`, pack);
    return;
  }

  const eventsFull = buildSyntheticEvents(true);
  const eventsMinimal = buildSyntheticEvents(false);
  const hexagrams = buildSyntheticHexagrams();
  const festivals = buildSyntheticFestivals();
  const packFull = { manifest: buildManifest({ events: eventsFull, hexagrams, festivals }), historicalEvents: eventsFull, hexagrams, festivals };
  const packMinimal = {
    manifest: buildManifest({ events: eventsMinimal, hexagrams, festivals }),
    historicalEvents: eventsMinimal,
    hexagrams,
    festivals,
  };

  for (const [label, pack] of [
    ['占位文本 · 完整字段（含 sourceUrl/attribution/retrievedAt）', packFull],
    ['占位文本 · 精简字段（省略可选字段）', packMinimal],
  ] as const) {
    const result = validateContentPack(pack);
    console.log(`\n${label}`);
    console.log(`schema 校验: ${result.ok ? '通过' : '失败'}（errors=${String(result.errors.length)}, warnings=${String(result.warnings.length)}）`);
    reportPack(label, pack);
  }

  const skeletonBytes = bytesOf(HEXAGRAM_SKELETONS);
  console.log(`\n64 卦骨架（仅 id/name/symbol）: ${kb(skeletonBytes)} (${String(skeletonBytes)} B)，gzip -9: ${kb(gzipBytesOf(HEXAGRAM_SKELETONS))}`);
  console.log('\n说明：占位文本为随机常用汉字，长度分布贴近真实文案；gzip 压缩率低于真实中文文案，故 gzip 数字是保守上界。');
}

main();
