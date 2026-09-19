# AgentOS Desktop

这是 AgentOS 的桌面应用壳，使用 Electron 加载现有的全屏 macOS 风格工作区。

## 运行

```bash
npm install
npm start
```

窗口默认使用 macOS 隐藏标题栏、隐藏原生红黄绿窗口控制、半透明背景和 1024×640 最小尺寸。使用 `⌘⇧F`（Windows/Linux 为 `Ctrl⇧F`）切换原生全屏。

## Octop 后端

桌面端已内置 Octop API 适配层，默认探测 `http://127.0.0.1:8088`。接口说明和启动方式见 [OCTOP-INTEGRATION.md](./OCTOP-INTEGRATION.md)。

启动 Octop 后可先运行 `npm run octop:check` 验证健康接口；再运行 `npm start` 打开桌面端。设置 `OCTOP_USERNAME` 与 `OCTOP_PASSWORD` 后，smoke check 还会验证 JWT、Agent 列表和首个 Agent 状态。
