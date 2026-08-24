# S06 眼科 treatment 层·术前核对记录首切测试报告

日期：2026-08-22  
状态：`LOCAL_VERIFIED`（S01–S10 整体仍 `IN_PROGRESS`）  
范围：FR-134 / S06 眼科 treatment 层·术前核对（workbench/evidence/care/followup/qc 五层仍待办）

## 结论

S06 眼科专科 treatment 层新增术前核对记录首切：`ophthalmology_preop_verification` 记录眼科手术前的术眼核对事件（术眼 OD/OS/OU、核对者、见证者、核对时间）。核对闭环硬门：双人核验（核对者与见证者分离，`verified_by <> witnessed_by` + `SELF_VERIFICATION_FORBIDDEN`）；术眼必须为真实单/双眼（OD/OS/OU）；身份不可变。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。真实手术排台与 OCT/影像来源未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| OPV-001 | 双人核对术眼 | 落库，术眼/核对者/见证者落库 | `givenVerification_whenRecording_thenRecorded` |
| OPV-002 | 见证者为本人 | 拒绝 `SELF_VERIFICATION_FORBIDDEN` | `givenSelfWitness_whenRecording_thenRejected` |
| OPV-003 | 绕过服务同人核验 | 数据库约束拒绝 | `givenSameProviderBypass_whenInserting_thenDatabaseRejects` |
| OPV-004 | 核对记录篡改 | 不可变触发器拒绝 | `givenVerification_whenTampered_thenDatabaseRejectsMutation` |

## 自动化门禁

```text
Java: 92 suites / 340 tests / 0 failure（+1 套件 +4 眼科术前核对测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 312 schemas / 320 generated outputs / 282 operations
Database: V1-V104 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V104__ophthalmology_preop_verification.sql`：`ophthalmology_preop_verification`（患者/就诊/院区/术眼 OD·OS·OU/核对者/见证者/核对时间、「核对者与见证者分离」显式命名约束、身份不可变触发器、患者索引）。
- 新增 `OphthalmologyPreopVerificationService`/`Controller`/`ExceptionHandler`：`POST /ophthalmology-preop-verifications`（双人核验硬门 + 活动就诊校验 + 幂等）、`GET /ophthalmology-preop-verifications`；契约新增 2 个 Schema 与 2 个端点（312 schemas / 320 outputs / 282 operations）。

## 未关闭风险

- S06 眼科仅完成 record 层与 treatment 层术前核对；workbench/evidence/care/followup/qc 五层、真实手术排台与 OCT/影像来源未实现，S01–S10 保持 `IN_PROGRESS`。
