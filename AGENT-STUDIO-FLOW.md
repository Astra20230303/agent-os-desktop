# Agent Studio 业务与 UI/UX 流程

## 目标

Agent Studio 是 Agent 的产品化开发入口。用户从业务目标出发，装配 Expert、Skill、Plugin、MCP 四类资产，完成端侧测试后，通过 Octop 创建、运行和发布 Agent。

Agent 是最终业务产品容器；四类资产是可复用的生态组件。

## 业务闭环

新建 Agent -> 定义目标 -> 绑定 Expert -> 装配四库资产 -> 配置权限 -> 端侧测试 -> 发布检查 -> 创建 Octop Agent -> 发布 Agent Hub -> 安装到 Desktop。

## 创建方式

- 空白 Agent：从业务目标开始配置。
- 从 Expert 创建：继承角色、提示词和默认工作流。
- 从 Agent Hub 导入：安装已有 Agent 后继续编辑。

## Studio 模块

- 项目：新建 Agent、我的 Agent、版本历史。
- 开发：蓝图、Expert、四库资产、画布编排、权限。
- 验证：基础对话、Skill 路由、Plugin 调用、MCP 上下文、权限边界、异常恢复、执行轨迹。
- 发布：依赖检查、Manifest 校验、端侧测试、Octop 创建、Expert 发布、Agent Hub 上架。

## 生态组件提交流程

Agent、Skill、Plugin、MCP 均可从 Agent Hub「我的资产」提交。提交表单要求组件类型、名称、语义化版本、能力描述和可选 Manifest；Desktop 先做字段、版本号和 JSON 结构校验，再生成本地审核队列记录。审核状态包括「审核中」「已通过」「已驳回」，通过后才进入 Agent Hub 展示，Plugin / MCP 的敏感权限仍由 Octop 管理端复核。Octop 未提供统一提交接口时，队列保存在本机，后续可无缝切换为远程审核 API。

## 四库职责

| 资产 | 作用 | 管理边界 |
| --- | --- | --- |
| Expert | 角色、语气、任务边界 | Desktop 绑定，Octop 发布 |
| Skill | 可复用业务能力 | Desktop 展示，Octop 安装 |
| Plugin | 外部系统和工具 | Octop 安装、授权、审计 |
| MCP | 上下文和数据连接 | Octop 管理连接和权限 |

## 版本与异常

每次发布生成不可变版本，支持对比、升级、回滚和停止发布。Octop 未连接时允许离线编辑和导出，但不能创建远程 Agent 或提交 Hub。发布失败必须显示失败阶段、API 错误、半成品状态和重试入口。

## 分阶段开发

1. 新建 Agent 向导与项目状态。
2. 四库依赖校验与发布流水线。
3. Octop Agent 创建与发布状态回流。
4. Agent Hub 安装回流与桌面图标。
5. 资产版本、更新、回滚和审核。
