# A02 动作审批首切测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（A02 整体仍 `IN_PROGRESS`）  
范围：FR-120–124 / A02 全局 AI 助手·动作审批（顶栏/浮窗 UI 与限频/转任务仍待办）

## 结论

A02 全局 AI 助手域新增动作审批首切：`action_approval` 记录 AI 提议的动作类型（开药/开检/开影像/建文书/其他）、动作摘要、提议人与提议时间，状态机 `PROPOSED→APPROVED/REJECTED`。人机协作安全硬门：审批人必须与提议人不同（`check (decided_by is null or decided_by <> proposed_by)` + 服务端 `ACTION_SELF_APPROVAL_FORBIDDEN`），杜绝 AI 动作自提议自批准；已批准/已拒绝须有审批人与审批时间（状态/时间一致性约束）。提议内容与身份字段不可变，决策走乐观锁。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。真实执行动作落地、顶栏/浮窗 UI 与限频/转任务未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| AA-001 | 提议并跨人批准 | PROPOSED→APPROVED | `ActionApprovalApiTest.givenProposal_…` |
| AA-002 | 同人提议并批准 | 拒绝 `ACTION_SELF_APPROVAL_FORBIDDEN` | `givenSameUser_whenDeciding_…` |
| AA-003 | 已决定动作重复决定 | 拒绝 `ACTION_APPROVAL_STATE_INVALID` | `givenDecidedProposal_whenDecidingAgain_…` |
| AA-004 | 提议内容不可篡改 | 摘要 UPDATE 被触发器拒绝 | `givenProposalIdentity_whenTampered_…` |

## 自动化门禁

```text
Java: 67 suites / 222 tests / 0 failure（+1 套件 +4 动作审批测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 248 schemas / 256 generated outputs / 219 operations
Database: V1-V79 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V79__action_approval.sql`：`action_approval`（动作类型/摘要/提议人/提议时间、「审批人与提议人不同」硬约束、`PROPOSED→APPROVED/REJECTED` 状态机与状态/时间一致性约束、身份不可变触发器、患者索引）。
- 新增 `ActionApprovalService`/`Controller`/`ExceptionHandler`：`POST /action-approvals`、`POST /action-approvals/{id}/decisions`（APPROVE/REJECT）、`GET /action-approvals`；契约新增 3 个 Schema 与 3 个端点（248 schemas / 256 outputs / 219 operations）。

## 未关闭风险

- A02 仅完成动作审批；真实执行动作落地、顶栏/浮窗 UI 与限频/转任务未实现，A02 保持 `IN_PROGRESS`。
