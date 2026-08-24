# S04 新生儿 evidence 层·筛查记录首切测试报告

日期：2026-08-22  
状态：`LOCAL_VERIFIED`（S01–S10 整体仍 `IN_PROGRESS`）  
范围：FR-132 / S04 新生儿 evidence 层·筛查记录（workbench/followup/qc 三层仍待办）

## 结论

S04 新生儿专科 evidence 层新增筛查记录首切：`neonatal_screening_record` 记录新生儿的听力/代谢/先心筛查结果。筛查闭环硬门：筛查异常（REFER）必须附转诊目标（数据库约束 `screening_result <> 'REFER' or referred_to 非空` + 服务端 `NEONATAL_SCREENING_REFER_REQUIRED`）；母婴身份分离（`mother_patient_id <> patient_id` + `MOTHER_NEONATE_SAME_PATIENT`）；母亲必须为女性（`MOTHER_NOT_FEMALE`）；身份不可变。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。真实筛查设备对接与筛查交接未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| NSCR-001 | 筛查通过 | PASS 落库并列表可见 | `givenPassScreening_whenRecording_thenRecorded` |
| NSCR-002 | 筛查异常附转诊 | 接受 | `givenReferScreeningWithTarget_whenRecording_thenAccepted` |
| NSCR-003 | 筛查异常缺转诊 | 拒绝 `NEONATAL_SCREENING_REFER_REQUIRED` | `givenReferScreeningWithoutTarget_whenRecording_thenRejected` |
| NSCR-004 | 母婴同患者 | 拒绝 `MOTHER_NEONATE_SAME_PATIENT` | `givenSameMotherNeonate_whenRecording_thenRejected` |
| NSCR-005 | 筛查篡改 | 不可变触发器拒绝 | `givenScreening_whenTampered_thenDatabaseRejectsMutation` |

## 自动化门禁

```text
Java: 105 suites / 395 tests / 0 failure（+1 套件 +5 新生儿筛查测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 341 schemas / 349 generated outputs / 310 operations
Database: V1-V117 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V117__neonatal_screening_record.sql`：`neonatal_screening_record`（新生儿/母亲/就诊/院区/筛查类型 HEARING·METABOLIC·CONGENITAL_HEART/筛查结果 PASS·REFER·PENDING/转诊目标/筛查时间/记录者、「母婴分离」「筛查异常必填转诊」显式命名约束、身份不可变触发器、新生儿索引）。
- 新增 `NeonatalScreeningRecordService`/`Controller`/`ExceptionHandler`：`POST /neonatal-screening-records`（转诊必填 + 母婴身份硬门 + 活动就诊校验 + 幂等）、`GET /neonatal-screening-records`；契约新增 2 个 Schema 与 2 个端点（341 schemas / 349 outputs / 310 operations）。

## 未关闭风险

- S04 新生儿仅完成 record/care/evidence 三层；workbench/followup/qc 三层、真实筛查设备对接与筛查交接未实现，S01–S10 保持 `IN_PROGRESS`。
