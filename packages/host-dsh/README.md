# huaxia-calendar-dsh — 华夏文明日历的 DeepSeek Harness 插件（v0.2.0）

> 装进 DeepSeek Harness（DSH）后：**中央整页月历 + 当日一屏** 保留；入口收进**设置**；
> 左下角常驻一张能看当月每一天的小月历（可拖到任意位置、可收起、可切年月）。
> 完全跟随宿主主题（light / dark 自动变），全离线：农历 / 节气 / 干支 / 节日由
> `@shishu/core` 本地实算，历史叙事来自 `@shishu/content-l1`，运行时不联网。

- 宿主运行时：`@deepseek-ai/dsh@0.2.2-rc.1`（`package.json.engines.dsh` 精确 pin，
  版本不符会被安装器硬拒并回滚）
- 浏览器半侧：`lib/client.js` 是 DSH 的模块加载器 bundle（`window.__ModuleLoader__.load({id, factory})`）
- 宿主半侧：`lib/index.js` 是空实现的 Cordis 插件，只为让 `cordis.patch.yml` 有一行可插入
- React **由宿主提供**（external），插件不打包自己的 React

## 装了什么席位

| 席位 | 类型 | 内容 |
|------|------|------|
| `main` | keyed | 中央整页月历 + 当日一屏（`key=huaxia-calendar`） |
| `settings.section` | list | 设置里的「华夏日历」分区（`id=huaxia-calendar`、`order=1000` 排最后）：打开完整日历 + 角落月历开关 |
| `shell.overlay` | list | 左下角常驻月历（`id=huaxia-calendar.mini`）；浮层本身点击穿透，卡片自己开 `pointer-events: auto` |

0.2.0 **删掉了** `sidebar.panellist`（左侧栏不再单独占一行）和右下角「今日」浮标。
三个席位都是 **root 作用域**：拿不到会话投影，日历也不需要会话数据，所以没有副作用。

## 装完在哪看

1. 重启（或刷新）DSH 的 Web UI；
2. **左下角**出现「华夏日历」小月历：当月每一天（上行公历、下行农历/节气）、
   `‹‹ ‹ 年月 › ››` 翻年翻月、`今` 回今天、点任意日期在底部看当日一行信息；
   按住标题栏可拖到任意位置（限制在视口内，刷新后保持）；`⌄` 收起成小条、`×` 隐藏；
3. **设置**（侧栏底部账号菜单 → 设置）里多一个 **「华夏日历」** 分区：
   「打开完整日历」按钮 + 「在角落显示月历」开关；
4. 打开完整日历 → **中央主区**整页月历：每格上行公历、下行农历（初一显示月名，
   节气日显示节气名），今天用宿主 `brand-primary` 高亮；侧边「今日一屏」：公历 + 农历 +
   干支 + 生肖 + 节气倒计时 + 当天一条历史叙事。

> 更新插件后浏览器要刷新页面：客户端模块跟随启动时的 release，插件更新不会热应用。

## 验证

### 三条离线命令（不需要启动 GUI）

```sh
cd packages/ui-react && node --test         # 纯逻辑测试（月网格 / 月历翻页 / 拖拽钳制 / 收起态 / 农历文案）
cd packages/host-dsh   && npm run build     # 产出 lib/
cd packages/host-dsh   && npm run verify    # 模拟 __ModuleLoader__ 接缝 + 真渲染 + 与 core 对账
cd packages/host-dsh   && npm run typecheck # tsc 对着 npm 上 0.2.2-rc.1 的类型
```

`npm run verify` 不只是「文件里有没有字符串」，它会：

- 断言 `package.json.dsh` 清单、`cordis.patch.yml`、`engines.dsh=0.2.2-rc.1`、版本号 0.2.0；
- 执行 bundle、断言 id 与包名一致、React 走 external、`@shishu/*` 已打进产物；
- 断言**只用宿主主题 token**（`--dsw-*` / `--dsh-*`），没有自造配色与字体栈；
- 断言注册了 `main` + `settings.section` + `shell.overlay`、**没有** `sidebar.panellist`，
  产物里没有「今日浮标」痕迹；
- 用 React 的轻量替身**真的渲染**组件：月网格必须是 7 的倍数、今天格子的农历日必须与
  `@shishu/core` 实算一致、当月节气名必须落在对应格子里、历史叙事有则渲染无则降级；
  左下角月历默认贴左下角、`pointer-events: auto`、整月带农历、年月翻页按钮齐全；
  用预置 localStorage 再装一遍，验证「收起态」与「拖拽位置恢复」。

### 端到端：隔离 DSH 实例（不碰用户正在跑的 GUI）

```sh
export DSH_HOME=/tmp/huaxia-020-home
export npm_config_cache=/tmp/npmcache-huaxia   # 本机 npm 缓存约定

# 1) 打包 + 装插件
cd packages/host-dsh && npm run build
npm pack --pack-destination /tmp
dsh plugin --profile web add /tmp/huaxia-calendar-dsh-0.2.0.tgz

# 2) 换端口另起一个实例，不重启用户 3080 的 GUI
dsh web --port 3205 --no-open
# 终端会打印带 token 的 URL，例如 http://127.0.0.1:3205/?token=...

# 3) 浏览器打开该 URL：首启会弹「预览版说明」弹窗，关掉后
#    左下角出现小月历；账号菜单 → 设置 → 华夏日历，可打开完整月历。
```

已验证过的环境：DSH `0.2.2-rc.1`、node `v24.16.0`、macOS。2026-11-19 实测：
tarball 安装成功 → 左栏无「华夏日历」行 → 设置里出现「华夏日历」分区 →
左下角 35 格月历（2026 年 11 月）→ 翻月/翻年/点 11-22 显示「当日交节 · 小雪」→
收起/展开 → 拖动到 (712,448) 后刷新位置保持 → 深色模式跟随宿主，控制台无报错。

## 目录

```
packages/host-dsh/
├── src/index.ts              # 宿主半侧（空 Cordis 插件）
├── src/client/index.tsx      # 浏览器半侧：注册 3 个席位 + 注入宿主动作
├── src/client/seats.ts       # 席位映射表（宿主版本升级只改这一处）
├── src/client/ambient.d.ts   # 类型层关键：激活宿主包的 declare module 合并
├── tsdown.config.ts          # bundle wrapper + 平台模块 external 表
├── cordis.patch.yml          # bundle 配置层
├── verify.mjs                # 离线契约 + 渲染验证
├── tsconfig.client.json
└── lib/                      # 构建产物（gitignored，npm files 只收这里 + patch）
```

## 已知限制（刻意不做）

- 只有一个宿主（DSH），VS Code 等宿主壳后续复用 `@shishu/ui-react`；
- `shell.overlay` 是页面内浮层，不是 OS 级置顶窗口，所以拖拽只能在浏览器视口内；
- 默认锚点是「主内容区左下角」（侧栏右侧）而不是视口 0 坐标：DSH 左侧栏底部是
  账号/设置入口，卡片压上去会让用户点不到设置（实测复现），所以宿主半侧会读
  `[data-conversation-region]` 的矩形来定位，侧栏收起时自动贴到视口左边；
- `shell.bottom` 整宽横条、右栏停靠面都没占（前者压缩三列高度，后者无会话首页缺席）；
- Token 按天聚合不在此包（M1 的宿主半侧工作）。
