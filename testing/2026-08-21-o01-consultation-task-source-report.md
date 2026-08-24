# O01 会诊来源接入统一临床任务测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（O01 整体仍 `IN_PROGRESS`）  
范围：FR-095 / O01 文书·会诊·路径·出院·Agent 任务来源（会诊首切）

## 结论

住院会诊申请在创建时同步生成 `CONSULTATION` 来源的统一临床任务（任务类型 `CONSULTATION_RESPONSE`，风险等级按紧急度映射 `EMERGENCY→CRITICAL`、`URGENT→HIGH`、`ROUTINE→ROUTINE`，`due_at` 与会诊时限一致，`business_state` 跟随 `REQUESTED`）；申请方确认完成后任务转入 `COMPLETED`（`SOURCE_COMPLETED`），拒绝时转入 `WITHDRAWN`（`SOURCE_WITHDRAWN`）。任务与事件不可变，且通过稳定来源键幂等汇聚。

这一结论只适用于本机合成数据。真实会诊跨科通知、科室级任务队列与团队视图未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| CS-001 | 创建会诊申请 | 生成 `CONSULTATION`/`CONSULTATION_RESPONSE` 任务，`risk_level=HIGH`（URGENT） | `InpatientAdmissionApiTest` 新增断言 |
| CS-002 | 申请方确认完成 | 任务 `COMPLETED`，事件链 `CREATED>SOURCE_COMPLETED` | 同一测试 |
| CS-003 | 拒绝会诊 | 任务 `WITHDRAWN`（`SOURCE_WITHDRAWN`） | `settleConsultationTask` 分支 |
| CS-004 | 幂等 | 来源键唯一约束 + `on conflict do nothing` | 稳定来源键 `(source_type, source_id, task_type)` |

## 自动化门禁

```text
Java: 32 suites / 89 tests / 0 failure（现有会诊测试新增任务证据断言）
Web: 5 files / 17 tests / 0 failure
Contracts: 145 schemas / 153 generated outputs / 117 operations
Database: V1-V39 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- `InpatientConsultationService.create` 在创建会诊后调用 `createConsultationTask` 生成统一任务；`change` 在 `COMPLETE`/`REJECT` 时调用 `settleConsultationTask` 收口任务。
- 复用既有 `clinical_task`/`clinical_task_event` 结构与 `CONSULTATION` 来源类型，无需新增迁移。

## 未关闭风险

- 会诊任务未单独写 Outbox（会诊自身 `InpatientConsultationRequested/…` 事件已随审计/Outbox 流动），下游通知与科室级任务队列仍待实现。
- 文书、临床路径、出院补救、Agent 审批等其他来源类型仍未接入统一任务流。
- 儿童/肝肾剂量、任务通知恢复、团队视图仍未完成。
