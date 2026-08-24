# S01 妇产 evidence 层·产前检查记录首切测试报告

日期：2026-08-22  
状态：`LOCAL_VERIFIED`（S01–S10 整体仍 `IN_PROGRESS`）  
范围：FR-129 / S01 妇产 evidence 层·产前检查（workbench/followup/qc 三层仍待办）

## 结论

S01 妇产专科 evidence 层新增产前检查记录首切：`obstetric_antenatal_exam` 记录孕产检查的孕周、宫高、胎心、血压、尿蛋白与子痫前期风险标记。产检闭环硬门：子痫前期风险标记必须对应高血压（收缩压≥140 或舒张压≥90）且尿蛋白阳性（数据库约束 + 服务端 `PREECLAMPSIA_RISK_CRITERIA_UNMET`）；孕周 0–45、胎心 60–200、血压生理范围约束；身份不可变。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。子痫全程监护与产后随访未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| OAE-001 | 正常产检 | 落库并列表可见 | `givenNormalExam_whenRecording_thenRecorded` |
| OAE-002 | 子痫前期风险达标 | 接受 | `givenPreeclampsiaRiskWithCriteria_whenRecording_thenAccepted` |
| OAE-003 | 子痫前期风险不达标 | 拒绝 `PREECLAMPSIA_RISK_CRITERIA_UNMET` | `givenPreeclampsiaRiskWithoutCriteria_whenRecording_thenRejected` |
| OAE-004 | 孕周越界 | 拒绝 `OBSTETRIC_ANTENATAL_REQUEST_INVALID` | `givenOutOfRangeWeeks_whenRecording_thenRejected` |
| OAE-005 | 产检篡改 | 不可变触发器拒绝 | `givenExam_whenTampered_thenDatabaseRejectsMutation` |

## 自动化门禁

```text
Java: 99 suites / 367 tests / 0 failure（+1 套件 +5 产前检查测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 326 schemas / 334 generated outputs / 295 operations
Database: V1-V111 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V111__obstetric_antenatal_exam.sql`：`obstetric_antenatal_exam`（患者/就诊/院区/孕周/宫高/胎心/血压/尿蛋白/子痫前期风险/检查时间/记录者、「孕周 0–45」「胎心 60–200」「血压范围」「子痫前期风险达标」显式命名约束、身份不可变触发器、患者索引）。
- 新增 `ObstetricAntenatalExamService`/`Controller`/`ExceptionHandler`：`POST /obstetric-antenatal-exams`（子痫前期风险硬门 + 活动就诊校验 + 幂等）、`GET /obstetric-antenatal-exams`；契约新增 2 个 Schema 与 2 个端点（326 schemas / 334 outputs / 295 operations）。

## 未关闭风险

- S01 妇产仅完成 record/treatment/evidence 三层；workbench/followup/qc 三层、子痫全程监护与产后随访未实现，S01–S10 保持 `IN_PROGRESS`。
