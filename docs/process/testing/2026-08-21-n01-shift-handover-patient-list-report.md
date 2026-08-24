# N01 患者级交接清单首切测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（N01 整体仍 `IN_PROGRESS`）  
范围：FR-050/096 / N01 护理交接班·患者级交接清单（转区任务迁移与移动床旁离线草稿仍待办）

## 结论

N01 护理交接班新增患者级交接清单首切：`shift_handover_patient` 将具体患者（含交接摘要与风险标记）挂到某次 `shift_handover`（DRAFT 交接班）。交接安全硬门：只有当前 `ADMITTED/TRANSFER_PENDING/DISCHARGE_PENDING` 且入住该病区的患者才能被加入交接清单（服务端硬门，`SHIFT_HANDOVER_PATIENT_NOT_ADMITTED`）；仅 DRAFT 交接班可追加患者项（`SHIFT_HANDOVER_STATE_INVALID`）。患者项整体不可变（`before update or delete` 触发器），事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。转区任务迁移、移动床旁离线草稿与真实交接风险自动抽取未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| HP-001 | 已入院患者加入交接清单并列表 | 患者项/风险标记正确 | `ShiftHandoverPatientApiTest.givenAdmittedPatient_…` |
| HP-002 | 未入住该病区患者加入 | 拒绝 `SHIFT_HANDOVER_PATIENT_NOT_ADMITTED` | `givenPatientNotAdmittedToWard_…` |
| HP-003 | 患者项篡改 | 被不可变触发器拒绝 | `givenHandoverPatientItem_whenTampered_…` |

## 自动化门禁

```text
Java: 57 suites / 181 tests / 0 failure（+1 套件 +3 患者级交接测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 218 schemas / 226 generated outputs / 189 operations
Database: V1-V69 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V69__shift_handover_patient_list.sql`：`shift_handover_patient`（交接摘要、风险标记、患者项整体不可变触发器、交接索引、交接×患者唯一约束）。
- `NursingService` 增加 `addHandoverPatient`（DRAFT 交接班 + 该病区活动入院双重硬门）与 `listHandoverPatients`；`NursingController` 增加 `POST /shift-handover-patients`、`GET /shift-handover-patients`；契约新增 2 个 Schema 与 2 个端点（218 schemas / 226 outputs / 189 operations）。

## 未关闭风险

- N01 仅完成患者级交接清单；转区任务迁移、移动床旁离线草稿与出院护理闭环未实现，N01 保持 `IN_PROGRESS`。
