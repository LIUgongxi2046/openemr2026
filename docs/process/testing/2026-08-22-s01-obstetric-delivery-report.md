# S01 妇产 treatment 层·产科分娩记录首切测试报告

日期：2026-08-22  
状态：`LOCAL_VERIFIED`（S01–S10 整体仍 `IN_PROGRESS`）  
范围：FR-129 / S01 妇产 treatment 层·产科分娩记录（workbench/evidence/care/followup/qc 五层仍待办）

## 结论

S01 妇产专科 treatment 层新增产科分娩记录首切：`obstetric_delivery_record` 记录产妇分娩事件（方式、时间、出血量、产程时长、产后出血标记、母婴关联）。分娩闭环硬门：产后出血标记必须对应 ≥500 ml 出血量（数据库约束 `not postpartum_hemorrhage or blood_loss_ml >= 500` + 服务端 `POSTPARTUM_HEMORRHAGE_BLOOD_LOSS`）；出血量非负；母婴身份分离（`neonate_patient_id <> patient_id` + `MOTHER_NEONATE_SAME_PATIENT`）；产妇必须为女性（`MOTHER_NOT_FEMALE`）；产程时长非负；身份不可变。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。产程全程监护、子痫处置与产后随访未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| OD-001 | 女性产妇记录分娩 | 落库并列表可见 | `givenFemalePatient_whenRecording_thenRecorded` |
| OD-002 | 产后出血标记但出血量不足 | 拒绝 `POSTPARTUM_HEMORRHAGE_BLOOD_LOSS` | `givenPostpartumHemorrhageWithLowBloodLoss_whenRecording_thenRejected` |
| OD-003 | 产后出血标记且出血量达标 | 接受 | `givenPostpartumHemorrhageWithHighBloodLoss_whenRecording_thenAccepted` |
| OD-004 | 母婴为同一患者 | 拒绝 `MOTHER_NEONATE_SAME_PATIENT` | `givenSameMotherNeonate_whenRecording_thenRejected` |
| OD-005 | 男性作为产妇 | 拒绝 `MOTHER_NOT_FEMALE` | `givenMalePatient_whenRecording_thenRejected` |
| OD-006 | 负出血量 | 拒绝 `OBSTETRIC_DELIVERY_REQUEST_INVALID` | `givenNegativeBloodLoss_whenRecording_thenRejected` |
| OD-007 | 记录篡改 | 不可变触发器拒绝 | `givenRecord_whenTampered_thenDatabaseRejectsMutation` |

## 自动化门禁

```text
Java: 86 suites / 311 tests / 0 failure（+1 套件 +7 产科分娩测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 300 schemas / 308 generated outputs / 270 operations
Database: V1-V98 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V98__obstetric_delivery_record.sql`：`obstetric_delivery_record`（产妇/新生儿/方式 VAGINAL·CESAREAN·FORCEPS·VACUUM/时间/出血量/产程时长/产后出血标记、「出血量非负」「产后出血标记≥500ml」「母婴身份分离」显式命名约束、身份不可变触发器、产妇索引）。
- 新增 `ObstetricDeliveryService`/`Controller`/`ExceptionHandler`：`POST /obstetric-delivery-records`（产后出血/母婴身份/女性产妇硬门 + 幂等）、`GET /obstetric-delivery-records`；契约新增 2 个 Schema 与 2 个端点（300 schemas / 308 outputs / 270 operations）。

## 未关闭风险

- S01 妇产仅完成 record 层与 treatment 层分娩记录；workbench/evidence/care/followup/qc 五层、产程全程监护与子痫处置未实现，S01–S10 保持 `IN_PROGRESS`。
