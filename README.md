# AgentOS Desktop

这是 AgentOS 的桌面应用壳，使用 Electron 加载现有的全屏 macOS 风格工作区。

## 运行

```bash
npm install
npm start
```

首次克隆需要初始化 Octop 子仓库：

```bash
git submodule update --init --recursive
```

Electron 启动时会先检查 `http://127.0.0.1:8088/api/health`；如果 Octop 未运行，会自动从 `vendor/octop` 启动。也可以用 `OCTOP_DIR=/path/to/Octop npm start` 指定本地 Octop 工作区。已运行的 Octop 会直接复用，Electron 退出时只会回收由它自己启动的进程。

窗口默认使用 macOS 隐藏标题栏、隐藏原生红黄绿窗口控制、半透明背景和 1024×640 最小尺寸。使用 `⌘⇧F`（Windows/Linux 为 `Ctrl⇧F`）切换原生全屏。

## Octop 后端

桌面端已内置 Octop API 适配层，默认探测 `http://127.0.0.1:8088`。接口说明和启动方式见 [OCTOP-INTEGRATION.md](./OCTOP-INTEGRATION.md)。

可运行 `npm run octop:check` 验证健康接口、JWT、Agent 列表和首个 Agent 状态；也可以直接 `npm start`，桌面端会负责先启动 Octop。

连接后点击顶部“专家中心”，可以在“我的专家 / 内置模板 / 专家市场”之间切换，查看能力和快速指令，并将模板创建或安装为桌面 Agent；完成后会自动同步图标并打开工作台。

Agent Hub 连接 Octop 后会同步专家、SkillHub、Plugin 和 Connector 目录；安装与权限仍由 Octop 执行，Desktop 负责展示、确认和打开工作台。

Desktop 通过统一的 `OCTOP.hubCatalog()`、`OCTOP.hubInstalled()` 和 `OCTOP.hubInstall()` 适配层访问生态资产，后续可直接切换到 Octop 的统一 Hub API。

## AURA 数字人 UX

AURA 支持悬浮球、小窗与全屏 Avatar Mode，并可在 Octop 登录后连接真实的 `AURA 系统助手` Agent。产品交互、接入契约、降级策略和上线验收见 [DIGITAL-HUMAN-UX.md](./DIGITAL-HUMAN-UX.md)。
