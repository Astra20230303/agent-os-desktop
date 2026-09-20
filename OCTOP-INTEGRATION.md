# Octop 后端对接

AgentOS Desktop 通过 `octop-client.js` 对接 [TencentCloud/Octop](https://github.com/TencentCloud/Octop)。桌面端默认访问 `http://127.0.0.1:8088`，并保持离线可用：Octop 未启动时，当前演示数据继续显示；Octop 可用后，网络状态面板会显示 API 连接状态。当前 Desktop 已提供统一 `hubCatalog / hubInstalled / hubInstall` 适配层，后续可平滑切换到 Octop 原生 `/api/hub` 聚合路由。

当前适配以运行中的 Octop 源码接口为准：健康响应兼容 `ok: true` 与 `status: "ok"`，Agent 路由优先使用返回的 `agent_id`，线程接口使用 `/threads`。

## 本地启动 Octop

```bash
octop init
octop run --host 127.0.0.1 --port 8088
```

启动后可先做无 UI 的接口验收：

```bash
npm run octop:check
OCTOP_USERNAME=admin OCTOP_PASSWORD='你的密码' npm run octop:check
OCTOP_USERNAME=admin OCTOP_PASSWORD='你的密码' OCTOP_WS=1 npm run octop:check
OCTOP_USERNAME=admin OCTOP_PASSWORD='你的密码' OCTOP_CREATE_THREAD=1 npm run octop:check
OCTOP_USERNAME=admin OCTOP_PASSWORD='你的密码' OCTOP_BROWSER=1 npm run octop:check
```

桌面端是独立客户端，若 Octop 配置了来源限制，需要把预览端加入 `OCTOP_CORS_ORIGINS`（例如 `http://127.0.0.1:4173,http://localhost:4173`）；使用 Electron 打包版时按 Octop 的部署方式允许桌面客户端来源。

Octop 的认证是 JWT：先调用 `POST /api/auth/login`，再把返回的 `access_token` 交给 `OCTOP.login()`。客户端已封装：

```js
await OCTOP.login('admin', 'your-password')
const agents = await OCTOP.listAgents()
const welcome = await OCTOP.welcome(agents[0].id)
const socket = new WebSocket(OCTOP.chatUrl(agents[0].id))
```

## 当前映射

| AgentOS Desktop | Octop API |
| --- | --- |
| 桌面 Agent 列表 | `GET /api/agents` |
| 内置专家模板 | `GET /api/experts` / `GET /api/experts/{expert_id}` |
| 从专家模板创建 Agent | `POST /api/agents/from-expert/{expert_id}` |
| 专家市场 | `GET /api/experts/hub` / `GET /api/experts/hub/{slug}` |
| 安装市场专家 | `POST /api/experts/hub/{slug}/install` |
| SkillHub 搜索 | `GET /api/skill-packages/hub/search?q=…&limit=…` |
| 从 SkillHub 创建 Skill Package | `POST /api/skill-packages/from-skillhub` |
| Plugin 目录 | `GET /api/plugins` |
| Connector / MCP 目录 | `GET /api/connectors/catalog` |
| Desktop 统一生态目录 | Desktop `OCTOP.hubCatalog()` 聚合 Expert / Skill / Plugin / Connector |
| Desktop 统一安装 | Desktop `OCTOP.hubInstall(kind, item)` 路由到 Octop 对应安装接口 |
| Octop 统一生态目录 | `GET /api/hub/catalog` |
| Octop 已安装资产 | `GET /api/hub/installed` |
| Octop 统一安装入口 | `POST /api/hub/install`（expert / skill；Plugin / Connector 由原生管理流负责） |
| 进程状态 | `GET /api/agents/{id}/status` |
| Agent 工作窗口欢迎语 | `GET /api/agents/{id}/chat/welcome`（读取 `welcome_message`） |
| 会话列表 / 新建会话 | `GET/POST /api/agents/{id}/threads` |
| 会话历史 | `GET /api/agents/{id}/threads/{thread_id}/history` |
| 对话流 | `WS /api/agents/{id}/chat/ws?token={jwt}` |
| Agent 主动通知 / Cron 推送 | `WS /api/notifications/ws?token={jwt}` |
| 任务中心列表 | `GET /api/agents/{id}/cron` |
| 任务启停 | `PATCH /api/agents/{id}/cron/{cron_id}` |
| 任务立即运行 | `POST /api/agents/{id}/cron/{cron_id}/run-now` |
| Agent 工作区目录 | `GET /api/agents/{id}/workspace/tree?path=…&from_workspace=true` |
| Agent 工作区文本预览 | `GET /api/agents/{id}/workspace/file?path=…&from_workspace=true` |
| Agent 工作区文本保存 | `PUT /api/agents/{id}/workspace/file?path=…&from_workspace=true` |
| Agent 工作区上传 | `POST /api/agents/{id}/workspace/upload?path=…&from_workspace=true` |
| Agent 技能列表 | `GET /api/agents/{id}/skills` |
| Agent 工具状态 | `GET /api/agents/{id}/tool-settings` |
| 内置工具启停 | `PATCH /api/agents/{id}/tool-settings/{tool_name}` |
| Agent 工作区终端 | `WS /api/agents/{id}/terminal/ws?token={jwt}&session_id=…` |
| Remote Browser 会话状态 | `GET /api/browser/harness-sessions` |
| Remote Browser 控制权 | `POST /api/browser/sessions/{session_id}/handoff` |
| 会话执行轨迹 | `GET /api/agents/{id}/threads/{thread_id}/trajectory` |
| 轨迹指标 | `GET /api/agents/{id}/threads/{thread_id}/trajectory/metrics` |
| HITL 人工确认 | `POST /api/agents/{id}/chat/hitl/resume`（SSE） |
| Agent 启停 | `POST /api/agents/{id}/start` / `stop` |
| 主动退出登录 | `POST /api/auth/logout` |

连接后，桌面图标数据源切换为 Octop 返回的 Agent 列表，并每 8 秒刷新远程状态；网络面板可执行“断开并切回本地”，恢复离线演示 Agent。Provider 与 API Key 仍由 Octop 管理，桌面端不保存这些密钥。

登录后桌面还会保持一个通知 WebSocket：Octop 的 Cron / proactive care 推送会显示为桌面 toast，并进入右上角 Agent 通知中心；通知带有 `agent_id` 时，点击通知会直接打开对应 Agent。连接断开后客户端按退避策略自动重连，退出 Octop 时主动关闭连接。

远程 Agent 工作窗口右侧的“工作区”标签读取 Agent 工作区目录，并支持进入目录、返回上级和预览 UTF-8 文本文件。工作区接口要求 Agent 正在运行；二进制文件和写入操作暂留在后续迭代。

顶部“Agent 能力中心”读取远程 Agent 的技能和工具目录。技能目前以只读方式展示；可禁用的内置工具可以直接切换，Octop 会持久化工具 denylist。关键工具由 Octop 标记为不可禁用，Desktop 会保持禁用状态。

远程 Agent 工作窗口右侧的“终端”标签默认不自动执行命令，用户点击连接后才建立持久会话 WebSocket；命令在 Agent 工作区目录执行，支持输出、历史回放、断开和重连。终端连接受 Octop JWT 和服务端 PTY 能力限制。

“浏览器”标签读取 Octop Remote Browser 的当前会话、页面 URL、运行状态和控制权，并支持在 Agent / 用户之间交接控制权。独立浏览器工作区通过 `/api/browser-stream/ws` 显示实时画面，支持导航、画面点击、新建 / 切换 / 关闭标签页。

远程 Agent 会话的“轨迹”标签读取最近的工具调用和执行事件，并显示对话轮次与错误状态。WebSocket 对话收到 `hitl_required` 时，Desktop 会在消息流中显示批准 / 拒绝卡片，并通过 HITL SSE 恢复后续执行。

Agent 工作窗口默认打开“工作台”总览卡片，统一入口到对话参数、轨迹、工作区、终端、浏览器和记忆；各模块仍使用独立面板承载高风险操作，便于后续扩展可拖拽布局。
