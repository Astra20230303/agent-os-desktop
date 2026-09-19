# AgentOS × Octop 验收清单

## 已可验收（不需要配置 LLM Provider）

1. 启动 Octop：`octop init`、`octop run --host 127.0.0.1 --port 8088`
2. 先执行 `npm run octop:check`，确认健康接口可达；设置 `OCTOP_USERNAME` / `OCTOP_PASSWORD` 后可继续验证 JWT、Agent 列表和状态接口；增加 `OCTOP_WS=1` 可验证 WebSocket ping/pong，增加 `OCTOP_CREATE_THREAD=1` 可验证线程创建和历史读取（都不需要 Provider）。
3. 启动桌面端：`npm start`
4. 点击右上角网络图标，确认 Endpoint 为 `http://127.0.0.1:8088`
5. 使用 Octop 用户登录，确认桌面状态从“未连接”变为“已连接”
6. 确认 Octop Agent 列表同步为桌面图标
7. 打开网络面板，确认 Agent 数量和 Endpoint 信息可见
8. 在 Octop 后端执行启动/停止/重载后，桌面 Agent 状态在 8 秒内更新
9. 打开远程 Agent，确认会话可以创建、切换和恢复历史
10. 点击右上角通知图标，确认通知中心可打开；登录后服务端通知 WebSocket 应保持连接，收到 Cron / proactive care 推送后显示 toast、未读角标和通知列表
11. 点击顶部任务图标，确认任务中心可以读取远程 Cron；对任务执行暂停 / 启用和“立即运行”，确认操作结果反馈。
12. 打开远程 Agent 工作窗口右侧“工作区”，确认可以读取目录、进入子目录、返回上级、编辑并保存文本文件，以及上传文件。
13. 点击顶部“能力中心”，确认可以查看技能和工具；对可禁用工具切换状态，确认 Octop 返回更新后的状态。
14. 打开远程 Agent 工作窗口右侧“终端”，点击连接后执行 `pwd` 或 `echo AGENTOS_TERMINAL_OK`，确认输出显示并可断开。
15. 打开右侧“浏览器”，确认能看到 Remote Browser 会话状态；如果存在会话，测试“接管浏览器 / 交还 Agent”控制权切换。
16. 打开浏览器画面，确认实时帧、地址导航、画面点击以及新建 / 切换 / 关闭标签页正常。
17. 打开远程 Agent 的“轨迹”标签，确认能看到工具调用和执行事件；触发需要人工确认的工具时，确认批准 / 拒绝卡片可恢复或终止执行。
18. 打开远程 Agent 工作窗口，确认默认进入“工作台”总览，并能从卡片一键切换到工作区、终端、浏览器和轨迹面板。

## 配置 LLM Provider 后验收

1. 在 Octop 中配置 Provider、模型和 API Key。
2. 打开远程 Agent 工作窗口发送消息。
3. 确认消息经 WebSocket 流式返回，完成时显示完整回复。
4. 刷新桌面并重新打开同一 Agent，确认历史消息仍然存在。

## 当前实现边界

- Provider 与 API Key 不写入 AgentOS；由 Octop 管理并加密保存。
- 未配置 Provider 时，桌面连接、Agent 同步、会话管理和状态轮询仍可验收；真实模型回复会由 Octop 返回配置错误。
- 本地演示 Agent 保留离线回退，不会冒充 Octop 的真实状态。
