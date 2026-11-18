# huaxia-calendar-dsh — 华夏文明日历的 DeepSeek Harness 插件

> M0′ 宿主壳。装进 DeepSeek Harness（DSH）后，左侧栏多一行「华夏日历」，点开是
> **整页月历 + 当日一屏**；右下角常驻一个「今日」浮标。全离线：农历 / 节气 / 干支 /
> 节日由 `@shishu/core` 本地实算，历史叙事来自 `@shishu/content-l1`，运行时不联网。

- 宿主运行时：`@deepseek-ai/dsh@0.2.2-rc.1`（`package.json.engines.dsh` 精确 pin，
  版本不符会被安装器硬拒并回滚）
- 浏览器半侧：`lib/client.js` 是 DSH 的模块加载器 bundle（`window.__ModuleLoader__.load({id, factory})`）
- 宿主半侧：`lib/index.js` 是空实现的 Cordis 插件，只为让 `cordis.patch.yml` 有一行可插入
- React **由宿主提供**（external），插件不打包自己的 React

## 装了什么席位

| 席位 | 类型 | 内容 |
|------|------|------|
| `sidebar.panellist` | list | 侧栏入口：`id=huaxia-calendar`、`order=100`、`label=华夏日历`、日历 SVG 图标 |
| `main` | keyed | 中央整页月历（`key=huaxia-calendar`，与侧栏 `id` 必须一致才点得开） |
| `shell.overlay` | list | 右下角「今日」浮标（`id=huaxia-calendar.today`）；浮层本身点击穿透，浮标自己开 `pointer-events` |

`main` / `shell.overlay` 都是 **root 作用域**：拿不到会话投影，日历也不需要会话数据，所以没有副作用。

## 安装

### 方式一：本地 tarball（离线/内网首选，也是最稳的路径）

```sh
cd packages/host-dsh
npm install            # 首次：装构建依赖（见下方「依赖」）
npm run build          # 产出 lib/client.js + lib/index.js
npm pack --pack-destination /tmp   # → /tmp/huaxia-calendar-dsh-0.1.0-m0.0.tgz

# 装进你的 DSH profile（示例 profile 名 web）
dsh plugin --profile web add /tmp/huaxia-calendar-dsh-0.1.0-m0.0.tgz
```

> 更新 tarball 时注意：**版本号没变的情况下，pnpm 可能直接报 `Already up to date`
> 而复用旧产物**。要么先 `dsh plugin --profile web remove huaxia-calendar-dsh`
> 再 `add`，要么把 `package.json` 版本号加一。（Phase 0 实测踩过。）

### 方式二：git 来源（需一次授权）

```sh
dsh plugin --profile web add "git+https://github.com/<you>/huaxia-calendar-plugin.git#<sha>"
```

git 安装有**两道门槛**（Phase 0 实测）：包必须自带 `prepare` 构建脚本；用户必须在
profile 的 `pnpm-workspace.yaml` 里 `allowBuilds` 授权该包执行安装脚本，否则报
`ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`，**第一次安装一定会失败一次**再授权重试。
另外请把 commit sha 锁死，否则后续推送会悄悄改变实际运行内容。

### 依赖说明（为什么没有运行时依赖）

`package.json` 的 `dependencies` 是**空的**：`@shishu/core` / `@shishu/content-l1` /
`@shishu/ui-react` 都在 **devDependencies**，构建时被 tsdown 打进 `lib/client.js`
（约 550 kB，gzip 约 137 kB，其中主要是 vendor 的 lunar-javascript 历法引擎）。
它们不发布到 npm，若写进 `dependencies`，安装器会去 registry 拉不存在的包而失败。
DSH 只提供平台模块表里的模块（`react` / `react/jsx-runtime` / `@deepseek-ai/*`），
所以日历算法只能打进 bundle。

## 装完在哪看

1. 重启（或刷新）DSH 的 Web UI；
2. **左侧栏**「插件 / 自动化任务」下方多一行 **「华夏日历」**（日历图标）；
3. 点它 → **中央主区**整块换成月历：宣纸底、墨色字，每格上行公历、下行农历
   （初一显示月名如「十月」，节气日显示节气名如「小雪」），今天朱砂高亮，周末弱化；
   下方/侧边是「今日一屏」：公历 + 农历 + 干支 + 生肖 + 节气倒计时 + 当天一条历史叙事；
4. **右下角**常驻「今日」浮标：农历月日 + 今日节气（无节气时显示干支日），
   在任何页面都在（页面内浮层，不是 OS 级置顶）。

想换月份用面板右上角「‹ 上个月 / 今天 / 下个月 ›」；点任意日期，右栏切成该日「当日一屏」。

> 更新插件后浏览器要刷新页面：客户端模块跟随启动时的 release，插件更新不会热应用。

## 验证

### 三条离线命令（不需要启动 GUI）

```sh
cd packages/ui-react && node --test         # 纯逻辑测试（月网格 / 农历文案 / 节气映射）
cd packages/host-dsh   && npm run build     # 产出 lib/
cd packages/host-dsh   && npm run verify    # 模拟 __ModuleLoader__ 接缝 + 真渲染 + 与 core 对账
cd packages/host-dsh   && npm run typecheck # tsc 对着 npm 上 0.2.2-rc.1 的类型
```

`npm run verify` 不只是「文件里有没有字符串」，它会：

- 断言 `package.json.dsh` 清单、`cordis.patch.yml`、`engines.dsh=0.2.2-rc.1`；
- 执行 bundle、断言 id 与包名一致、React 走 external、`@shishu/*` 已打进产物；
- 断言三个席位按预期元数据注册；
- 用 React 的轻量替身**真的渲染**三个组件：月网格必须是 7 的倍数、今天格子的农历日
  必须与 `@shishu/core` 实算一致、当月节气名必须落在对应格子里、历史叙事有则渲染
  标题无则降级「今日暂无条目」。

### 端到端：隔离 DSH 实例（不碰用户正在跑的 GUI）

```sh
export DSH_HOME=/tmp/huaxia-m0-home
mkdir -p "$DSH_HOME"

# 1) 装插件（tarball 需先 npm run build && npm pack，见上）
dsh plugin --profile web add /tmp/huaxia-calendar-dsh-0.1.0-m0.0.tgz

# 2) 换端口另起一个实例，不重启用户 3080 的 GUI
dsh web --port 3201 --no-open
# 终端会打印带 token 的 URL，例如 http://127.0.0.1:3201/?token=...

# 3) 浏览器打开该 URL：首启会弹「预览版说明 / 开始使用」弹窗，关掉后
#    左栏出现「华夏日历」，点开即可看到月历与右下角「今日」浮标。
```

已验证过的环境：DSH `0.2.2-rc.1`、node `v24.16.0`、macOS。2026-11-18 实测：
tarball 安装成功 → 侧栏出现「华夏日历」→ 点开渲染 35 格月历（2026 年 11 月）→
点 11-22 显示「当日交节 · 小雪 · 15:23」→ 翻月 / 回今天正常，浏览器控制台无报错。

## 目录

```
packages/host-dsh/
├── src/index.ts              # 宿主半侧（空 Cordis 插件）
├── src/client/index.tsx      # 浏览器半侧：注册 3 个席位
├── src/client/seats.ts       # 席位映射表（宿主版本升级只改这一处）
├── src/client/ambient.d.ts   # 类型层关键：激活宿主包的 declare module 合并
├── tsdown.config.ts          # bundle wrapper + 平台模块 external 表
├── cordis.patch.yml          # bundle 配置层
├── verify.mjs                # 离线契约 + 渲染验证
├── tsconfig.client.json
└── lib/                      # 构建产物（gitignored，npm files 只收这里 + patch）
```

## M0′ 已知限制（刻意不做）

- 只有一个宿主（DSH），VS Code 等宿主壳后续复用 `@shishu/ui-react`；
- 不做主题切换 / 设置页（F12 不在 M0′ 范围），面板固定宣纸浅色；
- `shell.bottom` 整宽横条、右栏停靠面都没占（前者压缩三列高度，后者无会话首页缺席）；
- 「今日」浮标不是 OS 级置顶（DSH 内只有页面内浮层，OS 置顶要独立桌面壳）；
- Token 按天聚合不在此包（M1 的宿主半侧工作）。
