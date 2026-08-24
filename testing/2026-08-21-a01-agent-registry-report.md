# A01 Agent 目录首切测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（A01 整体仍 `IN_PROGRESS`）  
范围：FR-030–037/070–081 / A01 AI 平台·Agent 目录（Skill/Tool 目录、预算/fencing/审批与 SSE 恢复仍待办）

## 结论

A01 AI 平台新增 Agent 目录首切：`agent_registry` 记录 Agent 编码、名称、版本与状态 `ACTIVE/INACTIVE`。目录治理硬门：Agent 编码唯一且不可变（数据库唯一约束 + 触发器保护 agent_code/agent_name/agent_version）。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。Skill/Tool 目录、Agent 依赖解析、预算/fencing/审批与 SSE 恢复未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| AR-001 | 登记并列表 Agent | ACTIVE Agent 正确 | `AgentRegistryApiTest.givenAgent_…` |
| AR-002 | 停用活动 Agent | ACTIVE→INACTIVE | `givenActiveAgent_whenDeactivating_…` |
| AR-003 | Agent 身份不可变 | agent_code UPDATE 被触发器拒绝 | `givenAgentIdentity_whenTampered_…` |

## 自动化门禁

```text
Java: 68 suites / 225 tests / 0 failure（+1 套件 +3 Agent 目录测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 251 schemas / 259 generated outputs / 222 operations
Database: V1-V80 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V80__agent_registry.sql`：`agent_registry`（Agent 编码/名称/版本、`ACTIVE/INACTIVE`、编码唯一 + 身份不可变触发器、状态索引）。
- 新增 `AgentRegistryService`/`Controller`/`ExceptionHandler`：`POST /agent-registry`、`POST /agent-registry/{id}/deactivations`、`GET /agent-registry`（可按状态过滤）；契约新增 3 个 Schema 与 3 个端点（251 schemas / 259 outputs / 222 operations）。

## 未关闭风险

- A01 仅完成 Agent 目录；Skill/Tool 目录、Agent 依赖解析、预算/fencing/审批与 SSE 恢复未实现，A01 保持 `IN_PROGRESS`。
