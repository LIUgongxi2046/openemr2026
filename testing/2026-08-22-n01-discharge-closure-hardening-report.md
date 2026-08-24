# N01 出院护理闭环加固测试报告

日期：2026-08-22  
状态：`LOCAL_VERIFIED`（N01 整体仍 `IN_PROGRESS`）  
范围：FR-022/096 / N01 护理·出院护理闭环加固（给药执行任务未闭环与交接未完项硬门；转区任务迁移与移动端断网队列仍待办）

## 结论

N01 出院护理闭环在既有「活动护理计划阻断硬门」基础上，新增两项阻断硬门：(1) 就诊内存在未闭环的 MEDICATION 执行任务（`order_execution_task` 处于 `PENDING/ACCEPTED/IN_PROGRESS/PARTIAL`）时拒绝出院 `MEDICATION_TASKS_OPEN`；(2) 患者仍在 `DRAFT` 状态交接班清单（`shift_handover_patient` 关联 `shift_handover.status='DRAFT'`）时拒绝出院 `SHIFT_HANDOVERS_OPEN`。三项硬门在同一事务内校验，全部通过才写入不可变闭环记录与事件/审计/Outbox。本批为服务层硬门加固，无 Schema/契约变更。

这一结论只适用于本机合成数据。真实停药/在途执行竞态与移动端断网队列未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| DC-001 | 无未闭环项时出院 | 闭环记录落库 | `givenNoOpenCarePlans_whenClosing_thenClosureRecorded` |
| DC-002 | 活动护理计划未停用 | 拒绝 `NURSING_CARE_PLANS_OPEN` | `givenOpenCarePlan_whenClosing_thenRejected` |
| DC-003 | 未闭环给药执行任务 | 拒绝 `MEDICATION_TASKS_OPEN` | `givenOpenMedicationTask_whenClosing_thenRejected` |
| DC-004 | 患者仍在 DRAFT 交接班 | 拒绝 `SHIFT_HANDOVERS_OPEN` | `givenDraftHandover_whenClosing_thenRejected` |
| DC-005 | 闭环记录篡改 | 不可变触发器拒绝 | `givenClosure_whenTampered_thenDatabaseRejectsMutation` |

## 自动化门禁

```text
Java: 81 suites / 281 tests / 0 failure（+2 出院闭环加固测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 288 schemas / 296 generated outputs / 258 operations（本批无契约变更）
Database: V1-V93 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- `NursingService.closeNursingDischarge` 在活动护理计划检查之后新增两项同事务硬门：未闭环 MEDICATION 执行任务计数（关联 `clinical_order_item.item_type='MEDICATION'`）与患者未完交接班计数（`shift_handover.status='DRAFT'`），任一非零即抛 `MEDICATION_TASKS_OPEN` / `SHIFT_HANDOVERS_OPEN`。
- `NursingDischargeClosureApiTest` 增加 `seedOpenMedicationTask`/`seedDraftHandover` 种子与两条拒绝用例；无 Schema/契约变更。

## 未关闭风险

- N01 仅完成出院闭环硬门加固；转区任务迁移、移动端断网队列与真实停药/在途执行竞态未实现，N01 保持 `IN_PROGRESS`。
