# 内容数据样本（schema 示例，非产品内容）

本目录存放 `@shishu/core` 数据 schema 的**最小示例**，用途只有一个：说明各类 JSON 的字段形状，供 `packages/core/test/data-schema.test.ts` 等测试与体积估算复用。

## 许可证铁律（务必先读）

- **样本不得包含任何 CC BY-SA 内容**，也不得转写维基百科、百度百科或其它百科站的正文。
  原因：CC BY-SA 的「相同方式共享」义务会随 `@shishu/core` 的 `src/` 一起分发，传染整个包；
  百科正文还与「原创策展」的内容口径不符。完整裁定见 `docs/phase0/内容层可行性.md`。
- 样本条目只允许 `license: "self-authored"`（原创示例文本）或 `public-domain`（如《周易》经文等已过版权保护期的原文）。
- 需要 CC 许可的**测试夹具**请直接在测试代码里内联构造（例如 `data-schema.test.ts` 中校验「CC 条目缺署名只报 warning」的用例），**不要**写进本目录的 JSON，避免被误当作可分发内容。
- 新增样本前先过 `docs/content-review-checklist.md`。

## 文件说明

| 文件 | 用途 | 注意 |
|------|------|------|
| `historical-events.sample.json` | `HistoricalEvent` 示例（3 条，全部 `self-authored`） | 仅演示字段形状，不是 L1 内容包；正式 30 天内容见 `packages/content-l1/` |
| `hexagrams.sample.json` | `Hexagram` 示例（1 条，经文为公有领域） | 白话解读须原创，不得翻译受版权保护的白话本 |
| `festivals.sample.json` | `CustomFestivalDef` 示例（2 条，原创） | 法定节假日调休安排不属于可算法计算的数据 |
| `manifest.sample.json` | `ContentPackManifest` 示例 | `files[].bytes/sha256` 是占位值，真实值必须由构建脚本计算 |

## 修改样本后

```bash
npm test --workspace=@shishu/core   # node --test
```

样本条数与 `manifest.sample.json` 的 `counts` 必须保持一致（当前 `historicalEvents: 3`）。
