# Agent v2 开发计划入口

本目录是 Agent 优化版 PRD、Medical Agent Harness LLD 和“AI 医助小南”v2 UI 交付的开发执行入口。当前仅完成 S007 计划拆解，所有任务均为 `PLANNED`。

## 文件

| 文件 | 用途 |
|---|---|
| `implementation-backlog.md` | 范围、现状、决策门禁、批次、临界路径、Harness/主 Agent/UI/试点/发布任务卡 |
| `child-agent-task-cards.md` | 33 个候选子 Agent 的独立输入、Tool/Skill、Schema、预算、阻断、Eval、DoD 与回滚 |
| `task-dag.csv` | 78 个稳定 task ID 的依赖 DAG、并行组、风险、承接 skill 和状态 |
| `s008-first-slice-context.md` | 第一个推荐实施任务 `PLT-001` 的最小上下文包 |

## 执行顺序

1. 先执行 `PLT-001`，不等待试点场景决策。
2. 并行完成 `DEC-001..006`，其中 `DEC-002` 和 `DEC-006` 是子 Agent/Composition 发布硬门。
3. 按 DAG 建立 Release、Run/Trajectory、Budget、Harness、Context、Tool、Composition、Verification、Eval 和 UI 契约。
4. 推荐用住院查房做第一条纵向切片，但仅在 `DEC-001` 批准后启动 `PILOT-*`。
5. commit、push/PR、生产迁移、灰度、生产扩面均是独立授权任务。

