# 华夏文明日历插件 · huaxia-calendar-plugin

一个能装在 AI 编码工具侧边栏/悬浮窗里的华夏文明日历——公历+农历+节气+历史叙事+每日卦象，同时展示每日工作进度、Token 消耗和任务清单。

支持 git 安装、内外网运行、离线可用；适配 DeepSeek、豆包 MarsCode、VS Code / Codex 等多宿主。

## 规划文档

- [整体规划方案（飞书云文档）](https://my.feishu.cn/docx/MZ5xdwZ4eodKdCxIF7RceWGBnee)
- [「时枢」可交互规划页](https://mcnnwkkt1uji.feishu.cn/page/BHWGmDubHdNg2IaiEDQcYCqynsc)
- [docs/整体规划方案.md](./docs/整体规划方案.md)（本仓库离线副本）

## 快速开始

（待 M0 骨架完成后补充安装说明）

## 路线图

- **M0（4-6 周）**：农历月历 + 每日一卦 + 侧栏/悬浮窗 + 本地工作日志
- **M1**：任务清单 + Token 统计 + 日报生成 + 四角悬浮置顶
- **M2**：历史长河时间轴 + 内容包订阅 + 多主题皮肤
- **M3**：Tauri 独立桌面版 + 数据可视化仪表盘

## 技术要点

- **一套核心，三种宿主**：核心逻辑收敛为纯本地 npm 包 `@shishu/core`，外面套三个壳（VS Code 扩展 .vsix、MCP Server、Tauri 悬浮窗）
- **全离线**：农历/干支/节气用 lunar-javascript 本地实算，全依赖 vendor 进仓库，零运行时联网
- **Git 安装**：内外网均可 `git clone` 部署
