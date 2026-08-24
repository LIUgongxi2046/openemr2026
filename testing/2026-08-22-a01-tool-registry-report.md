# A01 Tool 目录首切测试报告

日期：2026-08-22  
状态：`LOCAL_VERIFIED`（A01 整体仍 `IN_PROGRESS`）  
范围：FR-030–037/070–081 / A01 AI 平台·Tool 目录（预算/fencing/审批与 SSE 恢复仍待办）

## 结论

A01 AI 平台新增 Tool 目录首切：`tool_registry` 记录工具编码、名称、版本与工具类型（API/FUNCTION/DATABASE_QUERY/OTHER），状态 `ACTIVE/INACTIVE`。目录治理硬门：工具编码唯一且不可变（数据库唯一约束 + 触发器保护 tool_code/tool_name/tool_version/tool_type）。至此 A01 的「Agent/Skill/Tool 目录」三项首切全部落地。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。预算/fencing/审批、SSE 恢复与 Agent/Skill/Tool 依赖解析未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| TL-001 | 登记并列表工具 | ACTIVE 且类型正确 | `ToolRegistryApiTest.givenTool_…` |
| TL-002 | 停用活动工具 | ACTIVE→INACTIVE | `givenActiveTool_whenDeactivating_…` |
| TL-003 | 工具身份不可变 | tool_code UPDATE 被触发器拒绝 | `givenToolIdentity_whenTampered_…` |

## 自动化门禁

```text
Java: 73 suites / 242 tests / 0 failure（+1 套件 +3 Tool 目录测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 266 schemas / 274 generated outputs / 237 operations
Database: V1-V85 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V85__tool_registry.sql`：`tool_registry`（工具编码/名称/版本/类型、`ACTIVE/INACTIVE`、编码唯一 + 身份不可变触发器、状态索引）。
- 新增 `ToolRegistryService`/`Controller`/`ExceptionHandler`：`POST /tool-registry`、`POST /tool-registry/{id}/deactivations`、`GET /tool-registry`（可按状态过滤）；契约新增 3 个 Schema 与 3 个端点（266 schemas / 274 outputs / 237 operations）。

## 未关闭风险

- A01 仅完成 Agent/Skill/Tool 目录；预算/fencing/审批、SSE 恢复与依赖解析未实现，A01 保持 `IN_PROGRESS`。
