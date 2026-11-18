# Vendor: lunar-javascript 1.7.8

本目录是第三方库的**逐字节原样副本**，请勿修改 `lunar.js`。

| 项 | 值 |
| --- | --- |
| 上游仓库 | https://github.com/6tail/lunar-javascript |
| 上游版本 | `1.7.8`（npm `lunar-javascript@1.7.8`） |
| npm 包完整性 | `sha512-T79Lq2t5zjPu7[...]l9dJ5bP2ItXUQ==`（完整值见 npm registry） |
| npm tarball sha256 | `27170f0985dce4fd11c707235500560e4752bff4d5453335a967f5115c0b1cda` |
| `lunar.js` sha256 | `84f0105dd1c0be1c39990a0f38084f857901b1368c787c70b5687c8afd02298a` |
| 许可证 | MIT（见同目录 `LICENSE`，版权声明 `Copyright (c) 2018 6tail`） |
| 大小 | `lunar.js` 436,585 B（未压缩）/ 110,696 B（gzip -9） |

## 升级步骤

1. `export npm_config_cache=/tmp/npmcache-huaxia && npm pack lunar-javascript@<新版本>`
2. 解开 tarball，用其中的 `lunar.js`、`LICENSE` 覆盖本目录同名文件（**LICENSE 必须随附，MIT 合规要求保留版权声明**）。
3. 更新本文件里的版本号、sha256、npm 完整性值。
4. 跑 `npm test`（`node --test`）与 `node scripts/verify-against-hko.mjs`（联网交叉校验，可选），确认无回归。

## 为什么 vendor 而不是 dependencies

- 宿主（VS Code 扩展 / MCP Server / Tauri）要求 `git clone` 后**离线**可安装可运行；vendor 后 `packages/core` 的 `npm install` 无任何第三方依赖，断网也能装。
- `lunar.js` 是单文件 UMD，没有 ESM 子路径，`dependencies` 与 vendor 的产物体积完全一致，vendor 不增加分发成本。
- 代价：仓库多 436 KB（gzip 后约 108 KB），升级需手工同步；已用 sha256 固定，可审计。

MIT 许可证允许商用、修改与再分发，仅要求保留版权与许可声明；`LICENSE` 与原文件头注释均保留。
