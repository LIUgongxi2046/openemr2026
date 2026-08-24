# S01 妇产 followup 层·产后随访记录首切测试报告

日期：2026-08-22  
状态：`LOCAL_VERIFIED`（S01–S10 整体仍 `IN_PROGRESS`）  
范围：FR-129 / S01 妇产 followup 层·产后随访（workbench 一层仍待办）

## 结论

S01 妇产专科 followup 层新增产后随访记录首切：`obstetric_postpartum_followup` 记录产妇产后随访的恶露、伤口愈合与并发症情况。随访闭环硬门：异常恶露或伤口愈合不良必须附并发症描述（数据库约束 `(恶露正常且伤口良好) or 并发症非空` + 服务端 `OBSTETRIC_POSTPARTUM_COMPLICATION_REQUIRED`）；随访状态合法枚举；身份不可变。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。产后大出血远期随访与支持等级评审未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| OPP-001 | 正常产后随访 | 落库并列表可见 | `givenNormalFollowup_whenRecording_thenRecorded` |
| OPP-002 | 异常随访附并发症 | 接受 | `givenAbnormalFollowupWithComplications_whenRecording_thenAccepted` |
| OPP-003 | 异常随访缺并发症 | 拒绝 `OBSTETRIC_POSTPARTUM_COMPLICATION_REQUIRED` | `givenAbnormalFollowupWithoutComplications_whenRecording_thenRejected` |
| OPP-004 | 随访篡改 | 不可变触发器拒绝 | `givenFollowup_whenTampered_thenDatabaseRejectsMutation` |

## 自动化门禁

```text
Java: 101 suites / 375 tests / 0 failure（+1 套件 +4 产后随访测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 330 schemas / 338 generated outputs / 299 operations
Database: V1-V113 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V113__obstetric_postpartum_followup.sql`：`obstetric_postpartum_followup`（患者/就诊/院区/随访日期/恶露状态 NORMAL·ABNORMAL/伤口愈合 GOOD·COMPLICATED/并发症/记录者/记录时间、「异常随访必填并发症」显式命名约束、身份不可变触发器、患者索引）。
- 新增 `ObstetricPostpartumFollowupService`/`Controller`/`ExceptionHandler`：`POST /obstetric-postpartum-followups`（并发症必填硬门 + 活动就诊校验 + 幂等）、`GET /obstetric-postpartum-followups`；契约新增 2 个 Schema 与 2 个端点（330 schemas / 338 outputs / 299 operations）。

## 未关闭风险

- S01 妇产已完成 record/treatment/evidence/followup/qc 五层，仅剩 workbench 一层；产后大出血远期随访与支持等级评审未实现，S01–S10 保持 `IN_PROGRESS`。
