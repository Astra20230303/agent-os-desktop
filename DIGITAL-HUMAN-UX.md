# AURA 数字人 UX 与接入方案

## 产品定位

AURA 是 Agent OS 的常驻数字人入口，服务于“问一句，完成一件事”的工作流。数字人是 Agent 工作窗口的呈现层，不替代 Octop 的 Agent、任务、记忆和权限编排。

## 商业化体验原则

- **渐进式披露**：悬浮球用于低打扰待命，小窗用于连续对话，全屏 Avatar Mode 用于演示、接待和沉浸式交流。
- **状态可感知**：待命、聆听、思考、回答和错误都通过文案、头像动效、字幕和声音反馈表达。
- **动作可控**：本地系统指令继续走 Agent OS 路由；开放式问题在登录 Octop 后转给真实 AURA Agent，并保留失败降级。
- **商业可信**：全屏形态展示业务身份、连接状态、响应指标和权限承诺；敏感工具调用由 Octop 的 HITL 流程确认。
- **无障碍与降级**：不支持语音、数字人服务离线或窄屏时，仍可使用文本输入和普通 Agent 工作窗口。

## 当前已实现

1. AURA 小窗和全屏 Avatar Mode 的商业化视觉层，包括在线状态、快捷动作、权限提示和响应式布局。
2. 真实 Octop Agent 连接：首次连接时查找名为 `AURA 系统助手` 的 Agent，不存在则创建；之后创建或复用 `aura-desktop-*` 会话，通过 Agent WebSocket 接收流式回复。
3. 本地系统能力保留：系统状态、进程启停、Agent Hub、Agent Studio 等命令不会绕远程服务，避免明显延迟和误执行。
4. Octop 不可用时回退为本地能力，并明确提示“先连接 Octop”；不会把服务离线误报为已执行。

## 运行与体验

```bash
npm install
npm run lint
npm run octop:check
npm start
```

如果 Octop 已在 `http://127.0.0.1:8088` 运行，右上角连接 Octop 后打开 AURA（`⌘J`），输入开放式问题即可验证真实 Agent 链路。首次使用会按当前 Octop API 自动创建 AURA Agent，生产环境建议预置并锁定该 Agent 的 system prompt、工具权限和审计策略。

## 接入契约

当前复用 `octop-client.js` 的既有适配层：

- `GET /api/health`：连接探测
- `POST /api/auth/login`：JWT 登录
- `GET /api/agents`：查找 AURA Agent
- `POST /api/agents`：在缺失时创建 AURA Agent
- `GET/POST /api/agents/{id}/threads`：创建或复用 AURA 会话
- `WS /api/agents/{id}/chat/ws?token={jwt}`：发送 `user_turn` 并接收 `delta`/`text`/`done`

建议生产部署增加：

- 租户级 Agent ID 配置，避免按名称查找；
- 服务端 TTS / WebRTC 渲染器，把当前 SVG 视觉层替换成 MuseTalk、LivePortrait 或 OpenAvatarChat 适配器；
- 语音、头像和录制数据的明确授权开关；
- 工具调用审计、敏感操作二次确认和租户数据隔离。

## 许可证与上线注意事项

数字人编排代码、推理代码、模型权重、声音模型和人脸检测模型可能拥有不同许可证。上线前需要分别核对模型卡、训练数据、商用限制和用户肖像授权；不能因为上层仓库采用 Apache-2.0 或 MIT 就推断全部依赖可商用。

## 验收清单

- [ ] AURA 小窗、全屏形态、悬浮球可以互相切换。
- [ ] 本地指令能即时执行，开放式问题在 Octop 在线时由真实 Agent 返回。
- [ ] WebSocket 失败时有明确错误和本地降级，不伪造成功结果。
- [ ] 开启 TTS 后回答可朗读，关闭后不产生音频。
- [ ] 窄屏隐藏非核心侧栏，但输入、字幕和退出操作仍可用。
- [ ] 生产接入完成租户、权限、审计、肖像和模型许可证复核。
