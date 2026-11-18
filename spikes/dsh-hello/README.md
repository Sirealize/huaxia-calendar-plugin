# spikes/dsh-hello — Phase 0 最小可验证插件

这个目录不是产品代码，是**可执行的证据**：用来证明「华夏文明日历」作为 DeepSeek Harness（DSH）第三方客户端插件，在 `dsh 0.2.2-rc.1` 上确实能注册进 slot 并被宿主加载。
配套结论与证据见 [`docs/phase0/宿主可行性.md`](../../docs/phase0/宿主可行性.md)。

## 它做了什么

一个真实可安装的 DSH 组合包（bundle），同时含**两半**：

| 文件 | 作用 |
|------|------|
| `src/index.ts` → `lib/index.js` | 宿主半侧（Node Cordis 插件），空实现；存在的意义是让 `dsh.bundle.patch` 有一行可插入 |
| `src/client/index.tsx` → `lib/client.js` | 浏览器半侧，注册 3 个席位（见下） |
| `src/client/ambient.d.ts` | **类型层关键**：激活宿主包的 `declare module` 合并（`ctx.slots` 与 `SlotMap` 条目都由宿主包声明），不 import 它们则 `ctx.slots` 不存在、slot 名不合法 |
| `cordis.patch.yml` | bundle 的配置层，`insert` 一行把宿主半侧挂进 profile |
| `tsdown.config.ts` | 自己复现 DSH 的产物格式（`window.__ModuleLoader__.load({id, factory})`）；仓库里的 `packages/client/tsdown.client.ts` 预设没有发布到 npm |
| `verify.mjs` | 离线验证脚本：模拟 `__ModuleLoader__` 接缝，断言 bundle 注册了哪三个 slot |
| `lib/` | 已构建好的产物（**已提交，便于直接查看产物格式**） |

注册的三个席位：

1. `sidebar.panellist` + `main`（keyed）—— 侧栏图标 + 中央整页月历（主形态）
2. `shell.overlay`（list）—— 右下角常驻「今日」浮标（轻量形态）
3. `shell.bottom`（single）—— 代码里注释掉的可选整宽横条

## 怎么复现

```sh
cd spikes/dsh-hello

# 1) 装依赖（必须精确 pin，别用 latest —— 见文档「npm dist-tag 陷阱」）
export npm_config_cache=/tmp/npmcache-huaxia   # 本机 npm 默认缓存目录无权限
npm install

# 2) 构建：产出 lib/client.js（DSH 客户端 bundle 格式）+ lib/index.js（宿主半侧）
npm run build

# 3) 离线校验：不启动 GUI，验证 bundle 通过 __ModuleLoader__ 接缝并注册了 3 个 slot
npm run verify

# 4) 类型检查：对着 npm 上真实的 0.2.2-rc.1 类型定义检查
npm run typecheck
```

已验证的环境：node v24.16.0 / npm 11.13.0 / macOS。2026-11-18 实测：

- `npm install` → `added 49 packages`（16–36 s，取决于缓存）
- `npm run build` → `lib/client.js 3.91 kB`、`lib/index.js 0.38 kB`、`lib/index.d.ts 0.39 kB`
- `npm run verify` → `OK: bundle loads through the module-loader seam and claims 3 seats.`
- `npm run typecheck` → exit 0（对着 npm 包，非 DSH 源码）
- 上述 4 步在**本仓库副本内**重跑过一次（2026-11-18，`spikes/dsh-hello/`），同样全绿，可复现

## 装进一个真实 profile（隔离 DSH_HOME，不碰你的 `~/.dsh`）

```sh
npm pack                                  # 产出 dsh-hello-huaxia-0.0.1.tgz
export DSH_HOME=/tmp/dsh-spike-home       # 关键：隔离 home，绝不改用户 profile
dsh plugin --profile web add ./dsh-hello-huaxia-0.0.1.tgz
cat $DSH_HOME/profiles/web/package.json   # dsh.profile.bundles 里出现 dsh-hello-huaxia
dsh --profile web --dump-config | grep -A1 huaxia   # 出现 "# == dsh-hello-huaxia" 层
dsh --profile web --no-open --port 3199   # 另开一个实例（不要重启正在用的 3080）
```

2026-11-18 实测：装完后启动的实例，首页 `__DSH_BOOT__.entries` 里出现
`{"id":"dsh-hello-huaxia","url":"plugins/??dsh-hello-huaxia/client.js&rev=…","inject":["@deepseek-ai/dsh-client-ui-layout","@deepseek-ai/dsh-client-ui-sidebar"]}`，
该 URL 返回 `200 text/javascript` 且内容就是 `lib/client.js`。
**未验证**：React 组件在真实浏览器里渲染（没有跑浏览器；见文档第七节）。

## 已知阻塞点 / 不要照抄的地方

- `tsdown` 的 `external` 选项已废弃（构建时 WARN），DSH 仓库用 `deps.neverBundle`；照抄前先对齐版本。
- CSS Modules / 图片资源：DSH 仓库预设会把 CSS 编译成 bundle 内延迟注入的样式、把图片重命名进 `lib/assets/` 并走 `/plugins` 资源路由；**这套预设没有发布**，本 spike 用内联样式规避。真做日历 UI 要么自己实现同样的 CSS 处理，要么接受内联样式。
- `dsh.client.inject` 里列的包必须真实存在（宿主运行时的包，不是本包的依赖）；本 spike 只声明了两个宿主 UI 包。
