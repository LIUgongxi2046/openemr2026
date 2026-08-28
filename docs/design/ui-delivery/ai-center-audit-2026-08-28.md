# AI 中心原型还原与功能验收

日期：2026-08-28
原型基线：`prototype/app/coverage.js`、`prototype/app/styles.css`
产品入口：`/app/index.html#ai-center`

| 二级菜单 | 产品路由 | 原型对应页 | 本轮核查重点 | 验收结果 |
| --- | --- | --- | --- | --- |
| AI 总览 | `ai-center` | `ai-center` | 入口卡片、三列密度、九模块跳转 | 通过 |
| AI医助 Eva | `ai-assistant` | `ai-assistant` | 诊疗建议、连续对话、诊疗范围、医助任务、右侧窗 | 通过 |
| Eva 工作策略 | `ai-assistant-policy` | `ai-assistant-policy` | 策略草稿、版本、审批、发布、归档 | 通过 |
| 模型服务 | `models` | `models` | API 配置、连接状态、模型目录、编辑停用 | 通过 |
| 医助团队 | `agent-catalog` | `agent-catalog` | 主医助/子医助分工、示例、版本台账 | 通过 |
| 医助能力 | `skill-catalog` | `skill-catalog` | 能力流程、版本台账、编辑停用 | 通过 |
| 医助工具 | `tool-catalog` | `tool-catalog` | 调用鉴权流程、版本台账、编辑停用 | 通过 |
| 评测发布 | `agent-evals` | `agent-evals` | 三级医院评测集、生命周期、发布归档 | 通过 |
| 运行监测 | `aiops` | `aiops` | 额度、用量、明细、自动采集 | 通过 |

## 关键决策

- “AI医助 Eva”按原型恢复为“本次诊疗建议—对话—当前诊疗范围”三栏；1280px 以下逐步降为两栏和单栏。
- 保留现有真实 API 问答、主医助/子医助任务运行及进度汇总，不使用纯静态原型按钮替代业务交互。
- 医助团队、能力、工具和模型服务增加统一的五步流程与当前运行约束，解释配置如何影响后续医助任务。
- 右侧窗宽度采用 `clamp(380px, 32vw, 480px)`，窄屏切换为覆盖式单栏；主页面与窗体内部均限制横向溢出。
- 本地仿真库补齐 6 个模型、24 项医助能力、24 项医助工具和 10 项三级医院评测发布数据。

## 自动验收

- `scripts/audit-ai-center-layout.mjs`：9 个路由 × 3 个视口，加右侧窗；检查文档和核心模块横向溢出。
- `scripts/verify-ai-center-dialogs.mjs`：检查新增、编辑、删除弹窗、三级医院关键数据和页面横向溢出。
- 验收截图及结构化结果位于 `output/playwright/ai-center-layout/` 与 `output/playwright/ai-center-dialogs/`。
