# A01 Agent 运行预算首切测试报告

日期：2026-08-22  
状态：`LOCAL_VERIFIED`（A01 整体仍 `IN_PROGRESS`）  
范围：FR-070–081 / A01 AI 平台·运行预算（fencing/审批与 SSE 恢复仍待办）

## 结论

A01 AI 平台新增 Agent 运行预算首切：`agent_run_budget` 记录预算编码、名称、最大 token 数与最大时长（秒），状态 `ACTIVE/INACTIVE`。预算治理硬门：预算编码唯一且不可变（数据库唯一约束 + 触发器保护 budget_code/max_tokens/max_duration_seconds），token 与时长必须为正（数据库 `check` + 服务端双保险）。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。fencing 隔离、审批流与 SSE 恢复未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| AB-001 | 定义并列表运行预算 | ACTIVE 且限额正确 | `AgentRunBudgetApiTest.givenBudget_…` |
| AB-002 | 非正限额（0 token） | 拒绝 `AGENT_RUN_BUDGET_REQUEST_INVALID` | `givenNonPositiveLimits_…` |
| AB-003 | 停用活动预算 | ACTIVE→INACTIVE | `givenActiveBudget_whenDeactivating_…` |
| AB-004 | 预算身份不可变 | max_tokens UPDATE 被触发器拒绝 | `givenBudgetIdentity_whenTampered_…` |

## 自动化门禁

```text
Java: 76 suites / 253 tests / 0 failure（+1 套件 +4 运行预算测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 273 schemas / 281 generated outputs / 244 operations
Database: V1-V88 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V88__agent_run_budget.sql`：`agent_run_budget`（预算编码/名称/最大 token/最大时长、`ACTIVE/INACTIVE`、编码唯一 + 限额不可变触发器、状态索引）。
- 新增 `AgentRunBudgetService`/`Controller`/`ExceptionHandler`：`POST /agent-run-budgets`、`POST /agent-run-budgets/{id}/deactivations`、`GET /agent-run-budgets`（可按状态过滤）；契约新增 3 个 Schema 与 3 个端点（273 schemas / 281 outputs / 244 operations）。

## 未关闭风险

- A01 仅完成运行预算；fencing 隔离、审批流与 SSE 恢复未实现，A01 保持 `IN_PROGRESS`。
