/**
 * 性能基准（本机实测，非估算）。
 *
 * 运行：node scripts/bench.ts
 * 指标：
 * 1. 连续 10 年（2026-2035）逐日遍历：solarToLunar + getGanZhi + getFestivals 三件套；
 * 2. 各 API 单独吞吐；
 * 3. 24 节气批量计算耗时；
 * 4. 进程冷启动 + 模块加载耗时（在 docs 里用 `time node -e ...` 另测）。
 */
import { performance } from 'node:perf_hooks';
import os from 'node:os';
import process from 'node:process';
import {
  getFestivals,
  getGanZhi,
  getSolarTerms,
  solarToLunar,
} from '../src/index.ts';

const DAY_MS = 86_400_000;
const DAYS_10Y = (() => {
  let n = 0;
  for (let ms = Date.UTC(2026, 0, 1); ms <= Date.UTC(2035, 11, 31); ms += DAY_MS) n += 1;
  return n;
})();

interface Sample {
  name: string;
  iterations: number;
  elapsedMs: number;
}

function timeIt(name: string, iterations: number, fn: () => void): Sample {
  // 预热，避免 JIT 首次编译污染结果
  fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i += 1) fn();
  const elapsedMs = performance.now() - start;
  return { name, iterations, elapsedMs };
}

function format(sample: Sample): string {
  const perOpMs = sample.elapsedMs / sample.iterations;
  const opsPerSec = 1000 / perOpMs;
  return `${sample.name}: ${sample.iterations} 次 / ${sample.elapsedMs.toFixed(2)} ms → ` +
    `${perOpMs.toFixed(4)} ms/次，${Math.round(opsPerSec).toLocaleString('en-US')} 次/秒`;
}

function traverse10Years(): void {
  for (let ms = Date.UTC(2026, 0, 1); ms <= Date.UTC(2035, 11, 31); ms += DAY_MS) {
    const d = new Date(ms);
    const input = { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
    solarToLunar(input);
    getGanZhi(input);
    getFestivals(input);
  }
}

function main(): void {
  const cpu = os.cpus()[0];
  console.log('== @shishu/core 性能基准 ==');
  console.log(`环境: node ${process.version} / ${process.platform} ${process.arch}`);
  console.log(`CPU: ${cpu?.model ?? 'unknown'}（${String(os.cpus().length)} 核）`);
  console.log(`10 年天数: ${String(DAYS_10Y)}`);
  console.log('');

  const traverseRuns: Sample[] = [];
  for (let i = 0; i < 3; i += 1) {
    traverseRuns.push(timeIt('10 年逐日遍历（农历+干支+节日）', 1, traverse10Years));
  }
  for (const run of traverseRuns) console.log(format(run));
  const best = traverseRuns.reduce((a, b) => (a.elapsedMs < b.elapsedMs ? a : b));
  console.log(
    `  → 单日均耗时 ${(best.elapsedMs / DAYS_10Y).toFixed(4)} ms；三件套吞吐 ≈ ` +
      `${Math.round(DAYS_10Y / (best.elapsedMs / 1000)).toLocaleString('en-US')} 天/秒`,
  );
  console.log('');

  console.log(format(timeIt('solarToLunar 单次（2026-02-17）', 20_000, () => {
    solarToLunar({ year: 2026, month: 2, day: 17 });
  })));
  console.log(format(timeIt('getGanZhi 单次（2026-02-17）', 20_000, () => {
    getGanZhi({ year: 2026, month: 2, day: 17 });
  })));
  console.log(format(timeIt('getSolarTerms(2026) 单次', 2_000, () => {
    getSolarTerms(2026);
  })));
  console.log(format(timeIt('getFestivals 单次（2026-02-17）', 20_000, () => {
    getFestivals({ year: 2026, month: 2, day: 17 });
  })));

  // 节气整年批量：200 年 ≈ 4800 个节气
  console.log(format(timeIt('getSolarTerms 覆盖 1901-2100（200 年 × 24 节气）', 5, () => {
    for (let year = 1901; year <= 2100; year += 1) getSolarTerms(year);
  })));

  // 输出机器可读 JSON，方便把数字贴进文档
  const summary = {
    node: process.version,
    platform: `${process.platform} ${process.arch}`,
    cpu: cpu?.model ?? 'unknown',
    days10y: DAYS_10Y,
    traverse10yMs: Number(best.elapsedMs.toFixed(2)),
    traverse10yRunsMs: traverseRuns.map((r) => Number(r.elapsedMs.toFixed(2))),
    perDayMs: Number((best.elapsedMs / DAYS_10Y).toFixed(4)),
  };
  console.log('');
  console.log('JSON:', JSON.stringify(summary));
}

main();
