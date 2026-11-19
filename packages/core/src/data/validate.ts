/**
 * 内容数据校验（纯函数，零依赖）。
 *
 * 用途：
 * - 测试里校验示例 JSON 符合 schema；
 * - 内容生产流水线里作为「发布前闸门」：许可证缺失 = error，阻断打包。
 */
import type {
  ContentPackManifest,
  CustomFestivalDef,
  Hexagram,
  HistoricalEvent,
  L1ContentPack,
  LicenseId,
} from './schemas.ts';

export interface ValidationIssue {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

const LICENSES: ReadonlySet<string> = new Set<LicenseId>([
  'MIT',
  'Apache-2.0',
  'CC-BY-4.0',
  'CC-BY-SA-4.0',
  'CC0-1.0',
  'public-domain',
  'self-authored',
  'unknown',
]);

const HEXAGRAM_COUNT = 64;
const DAYS_PER_YEAR = 366;

function issue(
  out: ValidationIssue[],
  path: string,
  message: string,
  severity: 'error' | 'warning' = 'error',
): void {
  out.push({ path, message, severity });
}

function requireString(out: ValidationIssue[], path: string, value: unknown): void {
  if (typeof value !== 'string' || value.trim() === '') {
    issue(out, path, '必须是非空字符串');
  }
}

function requireLicense(out: ValidationIssue[], path: string, value: unknown): void {
  if (typeof value !== 'string' || !LICENSES.has(value)) {
    issue(out, path, `license 必须是受支持的许可证标识（收到 ${String(value)}）`);
    return;
  }
  if (value === 'unknown') {
    issue(out, path, 'license=unknown 禁止进入发布包（发布前必须清零）');
  }
}

function requireIntRange(out: ValidationIssue[], path: string, value: unknown, min: number, max: number): void {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    issue(out, path, `必须是 ${min}-${max} 的整数（收到 ${String(value)}）`);
  }
}

/** 校验单条历史事件；返回错误/警告列表（空数组 = 通过）。 */
export function validateHistoricalEvent(event: HistoricalEvent, path = 'event'): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  requireString(out, `${path}.id`, event.id);
  if (event.solar === undefined || event.solar === null) {
    issue(out, `${path}.solar`, '必须提供归档月日');
  } else {
    requireIntRange(out, `${path}.solar.month`, event.solar.month, 1, 12);
    requireIntRange(out, `${path}.solar.day`, event.solar.day, 1, 31);
  }
  if (typeof event.eventYear !== 'number' || !Number.isInteger(event.eventYear) || event.eventYear === 0) {
    issue(out, `${path}.eventYear`, '必须是非 0 整数（负数表示公元前）');
  }
  requireString(out, `${path}.yearLabel`, event.yearLabel);
  requireString(out, `${path}.title`, event.title);
  requireString(out, `${path}.summary`, event.summary);
  if (event.summary !== undefined && typeof event.summary === 'string' && event.summary.length > 300) {
    issue(out, `${path}.summary`, `摘要超过 300 字（当前 ${event.summary.length}），可能撑大包体`, 'warning');
  }
  requireString(out, `${path}.source`, event.source);
  requireLicense(out, `${path}.license`, event.license);
  if (event.region !== undefined && event.region !== 'china' && event.region !== 'world') {
    issue(out, `${path}.region`, `region 只能是 'china' 或 'world'（收到 ${String(event.region)}）`);
  }
  if (event.origin !== undefined && typeof event.origin !== 'string') {
    issue(out, `${path}.origin`, 'origin 必须是字符串，如「中国·北宋」');
  }
  if (event.region === undefined || event.origin === undefined) {
    issue(out, `${path}.region`, '建议同时标注 region 与 origin，便于轮播时区分中华文明与其他文明', 'warning');
  }
  if (event.dateKind !== undefined && event.dateKind !== 'exact' && event.dateKind !== 'period') {
    issue(out, `${path}.dateKind`, `dateKind 只能是 'exact' 或 'period'（收到 ${String(event.dateKind)}）`);
  }
  if (event.dateKind === undefined) {
    issue(out, `${path}.dateKind`, '建议标注 dateKind：exact 表示确为当日事件，period 表示文明坐标（非当日）', 'warning');
  }
  if (event.sourceUrl !== undefined && typeof event.sourceUrl !== 'string') {
    issue(out, `${path}.sourceUrl`, '必须是字符串');
  }
  if (typeof event.license === 'string' && (event.license === 'CC-BY-SA-4.0' || event.license === 'CC-BY-4.0')) {
    if (typeof event.attribution !== 'string' || event.attribution.trim() === '') {
      issue(out, `${path}.attribution`, 'CC 许可证条目必须提供署名文案（attribution）', 'warning');
    }
  }
  return out;
}

/** 校验单卦；返回错误/警告列表。 */
export function validateHexagram(hexagram: Hexagram, path = 'hexagram'): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  requireIntRange(out, `${path}.id`, hexagram.id, 1, HEXAGRAM_COUNT);
  requireString(out, `${path}.name`, hexagram.name);
  requireString(out, `${path}.symbol`, hexagram.symbol);
  if (typeof hexagram.binary !== 'string' || !/^[01]{6}$/.test(hexagram.binary)) {
    issue(out, `${path}.binary`, '必须是 6 位 0/1 字符串（自下而上）');
  }
  requireString(out, `${path}.guaCi`, hexagram.guaCi);
  requireString(out, `${path}.interpretation`, hexagram.interpretation);
  if (!Array.isArray(hexagram.yaoCi) || hexagram.yaoCi.length !== 6) {
    issue(out, `${path}.yaoCi`, '必须正好 6 条爻辞');
  } else {
    for (let i = 0; i < 6; i += 1) {
      const line = hexagram.yaoCi[i];
      requireString(out, `${path}.yaoCi[${String(i)}]`, line);
    }
  }
  requireString(out, `${path}.source`, hexagram.source);
  requireLicense(out, `${path}.license`, hexagram.license);
  return out;
}

/** 校验自定义节日。 */
export function validateCustomFestival(def: CustomFestivalDef, path = 'festival'): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  requireString(out, `${path}.id`, def.id);
  requireString(out, `${path}.name`, def.name);
  if (def.rule === undefined || def.rule === null) {
    issue(out, `${path}.rule`, '必须提供节日规则');
  } else {
    switch (def.rule.kind) {
      case 'solar-fixed':
      case 'lunar-fixed':
        requireIntRange(out, `${path}.rule.month`, def.rule.month, 1, 12);
        requireIntRange(out, `${path}.rule.day`, def.rule.day, 1, 30);
        break;
      case 'solar-term':
        requireString(out, `${path}.rule.term`, def.rule.term);
        break;
      case 'nth-weekday':
        requireIntRange(out, `${path}.rule.month`, def.rule.month, 1, 12);
        requireIntRange(out, `${path}.rule.weekday`, def.rule.weekday, 0, 6);
        requireIntRange(out, `${path}.rule.nth`, def.rule.nth, 1, 5);
        break;
      default: {
        const exhausted: never = def.rule;
        issue(out, `${path}.rule`, `未知规则类型：${JSON.stringify(exhausted)}`);
      }
    }
  }
  requireString(out, `${path}.source`, def.source);
  requireLicense(out, `${path}.license`, def.license);
  return out;
}

/** 校验 manifest 与文件清单计数/覆盖。 */
export function validateContentPackManifest(manifest: ContentPackManifest): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  if (manifest.schemaVersion !== '1.0.0') {
    issue(out, 'manifest.schemaVersion', '当前只支持 1.0.0');
  }
  requireString(out, 'manifest.packId', manifest.packId);
  requireString(out, 'manifest.packVersion', manifest.packVersion);
  requireString(out, 'manifest.title', manifest.title);
  requireString(out, 'manifest.generatedAt', manifest.generatedAt);
  requireLicense(out, 'manifest.license', manifest.license);
  requireString(out, 'manifest.attribution', manifest.attribution);
  return out;
}

/**
 * 校验完整 L1 内容包。
 *
 * 发布级要求（error）：
 * - 许可证字段齐全且不为 unknown；
 * - 64 卦齐全且不重复；
 * - manifest.counts 与实际数组长度一致；
 * - id 唯一。
 * 建议级要求（warning）：
 * - 365/366 天每天都至少 1 条历史事件（逐日覆盖）；
 * - 每条 CC 许可事件都有 attribution。
 */
export function validateContentPack(pack: L1ContentPack): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  errors.push(...validateContentPackManifest(pack.manifest).filter((i) => i.severity === 'error'));

  const ids = new Set<string>();
  for (const [index, event] of pack.historicalEvents.entries()) {
    const issues = validateHistoricalEvent(event, `historicalEvents[${String(index)}]`);
    for (const i of issues) (i.severity === 'error' ? errors : warnings).push(i);
    if (ids.has(event.id)) errors.push({ path: `historicalEvents[${String(index)}].id`, message: `id 重复：${event.id}`, severity: 'error' });
    ids.add(event.id);
  }

  const hexIds = new Set<number>();
  for (const [index, hexagram] of pack.hexagrams.entries()) {
    const issues = validateHexagram(hexagram, `hexagrams[${String(index)}]`);
    for (const i of issues) (i.severity === 'error' ? errors : warnings).push(i);
    if (hexIds.has(hexagram.id)) errors.push({ path: `hexagrams[${String(index)}].id`, message: `卦序重复：${hexagram.id}`, severity: 'error' });
    hexIds.add(hexagram.id);
  }
  if (hexIds.size !== HEXAGRAM_COUNT) {
    errors.push({ path: 'hexagrams', message: `64 卦不完整：实际 ${String(hexIds.size)} 卦`, severity: 'error' });
  }

  for (const [index, festivalDef] of pack.festivals.entries()) {
    const issues = validateCustomFestival(festivalDef, `festivals[${String(index)}]`);
    for (const i of issues) (i.severity === 'error' ? errors : warnings).push(i);
  }

  const { counts } = pack.manifest;
  if (counts.historicalEvents !== pack.historicalEvents.length) {
    errors.push({
      path: 'manifest.counts.historicalEvents',
      message: `manifest 写 ${String(counts.historicalEvents)}，实际 ${String(pack.historicalEvents.length)}`,
      severity: 'error',
    });
  }
  if (counts.hexagrams !== pack.hexagrams.length) {
    errors.push({
      path: 'manifest.counts.hexagrams',
      message: `manifest 写 ${String(counts.hexagrams)}，实际 ${String(pack.hexagrams.length)}`,
      severity: 'error',
    });
  }
  if (counts.festivals !== pack.festivals.length) {
    errors.push({
      path: 'manifest.counts.festivals',
      message: `manifest 写 ${String(counts.festivals)}，实际 ${String(pack.festivals.length)}`,
      severity: 'error',
    });
  }

  // 逐日覆盖检查：按公历月日去重
  const covered = new Set<number>();
  for (const event of pack.historicalEvents) {
    covered.add(event.solar.month * 100 + event.solar.day);
  }
  let expectedDays = 0;
  for (let month = 1; month <= 12; month += 1) {
    const daysInMonth = new Date(Date.UTC(2024, month, 0)).getUTCDate();
    for (let day = 1; day <= daysInMonth; day += 1) {
      expectedDays += 1;
      if (!covered.has(month * 100 + day)) {
        warnings.push({
          path: 'historicalEvents',
          message: `${String(month)} 月 ${String(day)} 日没有历史事件`,
          severity: 'warning',
        });
      }
    }
  }
  if (expectedDays !== DAYS_PER_YEAR) {
    warnings.push({ path: 'historicalEvents', message: `期望覆盖 ${String(DAYS_PER_YEAR)} 天，实际 ${String(expectedDays)} 天`, severity: 'warning' });
  }

  return { ok: errors.length === 0, errors, warnings };
}

/** 发布闸门：有 error 直接抛错。 */
export function assertContentPack(pack: L1ContentPack): void {
  const result = validateContentPack(pack);
  if (!result.ok) {
    const lines = result.errors.map((i) => `- ${i.path}: ${i.message}`).join('\n');
    throw new Error(`[shishu/core] 内容包校验失败：\n${lines}`);
  }
}
