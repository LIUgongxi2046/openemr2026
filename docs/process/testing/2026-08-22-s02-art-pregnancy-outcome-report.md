# S02 生殖 followup 层·妊娠结局随访记录首切测试报告

日期：2026-08-22  
状态：`LOCAL_VERIFIED`（S01–S10 整体仍 `IN_PROGRESS`）  
范围：FR-130 / S02 生殖 followup 层·妊娠结局随访（workbench/evidence/qc 三层仍待办）

## 结论

S02 生殖专科 followup 层新增妊娠结局随访记录首切：`art_pregnancy_outcome` 记录 ART 周期的妊娠结局（妊娠/未孕/生化/流产、结局日期、活产数、并发症）。随访闭环硬门：流产结局必须附并发症描述（数据库约束 `pregnancy_result <> 'MISCARRIAGE' or complications 非空` + 服务端 `ART_MISCARRIAGE_COMPLICATION_REQUIRED`）；活产数非负；身份不可变。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。配子/胚胎追溯与库存对账未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| APO-001 | 妊娠结局 | 落库并列表可见 | `givenPregnantOutcome_whenRecording_thenRecorded` |
| APO-002 | 流产附并发症 | 接受 | `givenMiscarriageWithComplications_whenRecording_thenAccepted` |
| APO-003 | 流产缺并发症 | 拒绝 `ART_MISCARRIAGE_COMPLICATION_REQUIRED` | `givenMiscarriageWithoutComplications_whenRecording_thenRejected` |
| APO-004 | 负活产数 | 拒绝 `ART_OUTCOME_REQUEST_INVALID` | `givenNegativeLiveBirth_whenRecording_thenRejected` |
| APO-005 | 结局篡改 | 不可变触发器拒绝 | `givenOutcome_whenTampered_thenDatabaseRejectsMutation` |

## 自动化门禁

```text
Java: 102 suites / 380 tests / 0 failure（+1 套件 +5 妊娠结局随访测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 332 schemas / 340 generated outputs / 301 operations
Database: V1-V114 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V114__art_pregnancy_outcome.sql`：`art_pregnancy_outcome`（患者/周期/就诊/院区/妊娠结局 PREGNANT·NOT_PREGNANT·BIOCHEMICAL·MISCARRIAGE/结局日期/活产数/并发症/记录者/记录时间、「活产数非负」「流产必填并发症」显式命名约束、身份不可变触发器、患者索引）。
- 新增 `ArtPregnancyOutcomeService`/`Controller`/`ExceptionHandler`：`POST /art-pregnancy-outcomes`（流产并发症硬门 + 活动就诊校验 + 幂等）、`GET /art-pregnancy-outcomes`；契约新增 2 个 Schema 与 2 个端点（332 schemas / 340 outputs / 301 operations）。

## 未关闭风险

- S02 生殖仅完成 record/treatment/followup 三层；workbench/evidence/qc 三层、配子/胚胎追溯与库存对账未实现，S01–S10 保持 `IN_PROGRESS`。
