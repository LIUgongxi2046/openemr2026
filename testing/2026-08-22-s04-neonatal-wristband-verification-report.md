# S04 新生儿 care 层·腕带标本核对记录首切测试报告

日期：2026-08-22  
状态：`LOCAL_VERIFIED`（S01–S10 整体仍 `IN_PROGRESS`）  
范围：FR-132 / S04 新生儿 care 层·腕带标本核对（workbench/evidence/treatment/followup/qc 五层仍待办）

## 结论

S04 新生儿专科 care 层新增腕带标本核对记录首切：`neonatal_wristband_verification` 记录新生儿腕带编号与标本编号的双人核对事件。核对闭环硬门：双人核验（核对者与见证者分离，`verified_by <> witnessed_by` + `SELF_VERIFICATION_FORBIDDEN`）；母婴身份分离（`mother_patient_id <> patient_id` + `MOTHER_NEONATE_SAME_PATIENT`）；母亲必须为女性（`MOTHER_NOT_FEMALE`）；腕带/标本编号非空；身份不可变。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。真实腕带扫描与标本条码对接未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| NWV-001 | 双人核对腕带标本 | 落库，核对者/见证者落库 | `givenVerification_whenRecording_thenRecorded` |
| NWV-002 | 见证者为本人 | 拒绝 `SELF_VERIFICATION_FORBIDDEN` | `givenSelfWitness_whenRecording_thenRejected` |
| NWV-003 | 母婴为同一患者 | 拒绝 `MOTHER_NEONATE_SAME_PATIENT` | `givenSameMotherNeonate_whenRecording_thenRejected` |
| NWV-004 | 母亲为男性 | 拒绝 `MOTHER_NOT_FEMALE` | `givenMaleMother_whenRecording_thenRejected` |
| NWV-005 | 核对记录篡改 | 不可变触发器拒绝 | `givenVerification_whenTampered_thenDatabaseRejectsMutation` |

## 自动化门禁

```text
Java: 89 suites / 326 tests / 0 failure（+1 套件 +5 腕带标本核对测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 306 schemas / 314 generated outputs / 276 operations
Database: V1-V101 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V101__neonatal_wristband_verification.sql`：`neonatal_wristband_verification`（新生儿/母亲/腕带编号/标本编号/核对者/见证者/核对时间、「核对者与见证者分离」「母婴身份分离」显式命名约束、身份不可变触发器、新生儿索引）。
- 新增 `NeonatalWristbandVerificationService`/`Controller`/`ExceptionHandler`：`POST /neonatal-wristband-verifications`（双人核验 + 母婴身份 + 女性母亲硬门 + 幂等）、`GET /neonatal-wristband-verifications`；契约新增 2 个 Schema 与 2 个端点（306 schemas / 314 outputs / 276 operations）。

## 未关闭风险

- S04 新生儿仅完成 record 层与 care 层腕带标本核对；workbench/evidence/treatment/followup/qc 五层、筛查交接与真实腕带扫描对接未实现，S01–S10 保持 `IN_PROGRESS`。
