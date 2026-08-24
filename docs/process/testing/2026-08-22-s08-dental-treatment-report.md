# S08 口腔 treatment 层·治疗操作记录首切测试报告

日期：2026-08-22  
状态：`LOCAL_VERIFIED`（S01–S10 整体仍 `IN_PROGRESS`）  
范围：FR-136 / S08 口腔 treatment 层·治疗操作记录（workbench/evidence/care/followup/qc 五层仍待办）

## 结论

S08 口腔专科 treatment 层新增治疗操作记录首切：`dental_treatment_record` 记录某 FDI 牙位的治疗操作（类型、材料批次、时间、操作者）。治疗闭环硬门：修复类治疗（充填/冠修复）必须附材料批次以便追溯（数据库约束 `treatment_type not in (FILLING,CROWN) or material_batch is not null` + 服务端 `DENTAL_TREATMENT_MATERIAL_BATCH_REQUIRED`）；FDI 牙位两段数码合法（`^[1-8][1-8]$` + 象限逻辑，服务端/数据库双重校验）；身份不可变。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。影像标注与材料库存对账未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| DT-001 | 充填附材料批次 | 落库并列表可见 | `givenRestorativeTreatmentWithBatch_whenRecording_thenRecorded` |
| DT-002 | 充填缺材料批次 | 拒绝 `DENTAL_TREATMENT_MATERIAL_BATCH_REQUIRED` | `givenRestorativeTreatmentWithoutBatch_whenRecording_thenRejected` |
| DT-003 | 非修复治疗缺批次 | 接受 | `givenNonRestorativeTreatmentWithoutBatch_whenRecording_thenAccepted` |
| DT-004 | 非法 FDI 牙位 | 拒绝 `DENTAL_TREATMENT_REQUEST_INVALID` | `givenInvalidToothNotation_whenRecording_thenRejected` |
| DT-005 | 治疗记录篡改 | 不可变触发器拒绝 | `givenTreatment_whenTampered_thenDatabaseRejectsMutation` |

## 自动化门禁

```text
Java: 88 suites / 321 tests / 0 failure（+1 套件 +5 口腔治疗测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 304 schemas / 312 generated outputs / 274 operations
Database: V1-V100 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V100__dental_treatment_record.sql`：`dental_treatment_record`（患者/就诊/院区/FDI 牙位/治疗类型 FILLING·EXTRACTION·ROOT_CANAL·CROWN·CLEANING·OTHER/材料批次/时间/操作者、「修复类治疗必填材料批次」「FDI 牙位合法」显式命名约束、身份不可变触发器、患者索引）。
- 新增 `DentalTreatmentService`/`Controller`/`ExceptionHandler`：`POST /dental-treatment-records`（材料批次追溯 + FDI 牙位硬门 + 活动就诊校验 + 幂等）、`GET /dental-treatment-records`；契约新增 2 个 Schema 与 2 个端点（304 schemas / 312 outputs / 274 operations）。

## 未关闭风险

- S08 口腔仅完成 record 层与 treatment 层治疗操作；workbench/evidence/care/followup/qc 五层、影像标注与材料库存对账未实现，S01–S10 保持 `IN_PROGRESS`。
