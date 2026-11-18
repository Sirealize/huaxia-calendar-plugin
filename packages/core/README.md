# @shishu/core

华夏文明日历核心算法层（Phase 0 Spike 可运行原型）。

- **纯函数**：不读写全局状态、不联网、不依赖后端。
- **全离线**：唯一第三方依赖 `lunar-javascript@1.7.8` 已逐字节 vendor 进 `vendor/`，`npm install` 零依赖、断网可装。
- **零构建验证**：TypeScript 源码用 Node ≥22.18 的**原生类型剥离**直接运行，`node --test` 即可跑测试，不需要 `tsc` / `vite` / `tsup`。
- **双端可用**：源码无 Node 专有 API；浏览器/宿主侧用 esbuild/vite 打包 TS 即可。

> 状态：Spike 原型，尚未发布 npm。版本号 `0.1.0-spike.0`，API 可能微调。
> 可行性结论、选型对比、实测数据见 [docs/evaluation/核心算法可行性.md](../../docs/evaluation/核心算法可行性.md)。

## 快速开始

```bash
cd packages/core
npm test                      # = node --test，零安装直接跑
node scripts/bench.ts         # 性能实测
node scripts/estimate-content-size.ts   # L1 内容包体积实测
```

最小用法（Node ≥22.18 直接跑 TS）：

```ts
import { solarToLunar, getGanZhi, getSolarTerms, getFestivals } from './packages/core/src/index.ts';

solarToLunar({ year: 2026, month: 2, day: 17 });
// → { lunarYear: 2026, lunarMonth: 1, lunarDay: 1, isLeapMonth: false,
//     lunarYearName: '二〇二六', lunarMonthName: '正月', lunarDayName: '初一',
//     lunarDateName: '二〇二六年正月初一', zodiac: '马', yearGanZhi: '丙午', ... }

getGanZhi({ year: 2026, month: 2, day: 5 });        // 默认立春口径 → year: '丙午'
getGanZhi({ year: 2026, month: 2, day: 5 }, { yearPolicy: 'lunar-new-year' }); // → '乙巳'

getSolarTerms(2026);        // 24 个节气，含精确时刻（北京时间）
getFestivals({ year: 2026, month: 2, day: 17 });     // [{ id: 'chun-jie', name: '春节', ... }]
```

## API

| API | 说明 |
| --- | --- |
| `solarToLunar(input)` | 公历 → 农历年/月/日（含闰月）、中文月名日名、生肖、春节口径干支、星期、年内日序 |
| `getGanZhi(input, options?)` | 年/月/日/时干支 + 生肖。年干支支持 3 种口径：`li-chun`（默认，立春精确时刻）、`li-chun-day`、`lunar-new-year` |
| `getSolarTerms(year)` | 指定公历年 24 节气：名称、节/气、太阳视黄经、北京时间日期与时刻、ISO 字符串、Unix 毫秒 |
| `getSolarTermOn(input)` | 当天是否节气日 |
| `getNextSolarTerm(input)` / `getPreviousSolarTerm(input)` | 上一/下一个节气（可跨年） |
| `getFestivals(input)` | 当日命中的节日（公历/农历/节气/自定义），闰月不重复过传统节 |
| 数据层 | `src/data/schemas.ts` 类型、`validate.ts` 发布前校验、`hexagram-names.ts` 64 卦骨架、`samples/` 示例 JSON |

入参 `input`：`{ year, month, day, hour?, minute?, second? }`（按北京时间解释）或 `Date`（按宿主本地时区字段读取）。所有时间口径为 **北京时间 UTC+8**。

## 测试

```bash
npm test    # node --test，44 个测试
```

覆盖：2026/2027 春节、闰月（2020 闰四月 / 2023 闰二月 / 2025 闰六月 / 2033 闰十一月）、
24 节气（2026 全年与 HKO 官方表 24/24 一致）、乾支纪年三种口径与边界时刻、
连续 10 年逐日遍历（3652 天）无异常/农历连续、数据 schema 与许可证强制校验。

离线测试不联网；跨库交叉校验是可选脚本（需联网）：

```bash
node scripts/verify-against-hko.mjs        # 用香港天文台 1901-2100 官方历表逐日核对
```

## `Date` 与浏览器打包说明

- 本包源码是 `.ts` 且 `main`/`exports` 指向 `.ts`：Node ≥22.18 可直接运行（用于测试与工具链）；
  宿主扩展/前端工程用 esbuild/vite/webpack 打包时天然支持 `.ts`，**无需本包预构建**。
- 若目标运行时 Node < 22.18 且不打包，请先构建成 JS（`npx esbuild src/index.ts --bundle --format=esm`）。

## 依赖策略

`vendor/lunar-javascript/` 为上游 MIT 许可的逐字节副本（含 `LICENSE` 与 `VENDOR.md` 审计信息）。
`package.json` 的 `dependencies` 为空。升级流程见 [VENDOR.md](./vendor/lunar-javascript/VENDOR.md)。

## 目录

```text
packages/core/
├── src/
│   ├── index.ts            # 公共 API
│   ├── types.ts            # 公共类型
│   ├── engine.ts           # vendor 适配层（唯一 import lunar-javascript 的模块）
│   ├── calendar.ts         # solarToLunar / getGanZhi
│   ├── solar-terms.ts      # 24 节气
│   ├── festivals.ts        # 节日
│   └── data/               # 数据 schema / 校验 / 64 卦骨架 / 示例 JSON
├── vendor/lunar-javascript/  # MIT，lunar.js + LICENSE + VENDOR.md
├── test/                   # node --test（.ts 直接运行）
└── scripts/                # bench / 体积实测 / HKO 交叉校验
```
