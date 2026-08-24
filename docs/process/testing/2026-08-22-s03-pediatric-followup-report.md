# S03 儿科 followup 层·随访记录首切测试报告

日期：2026-08-22  
状态：`LOCAL_VERIFIED`（S01–S10 整体仍 `IN_PROGRESS`）  
范围：FR-131 / S03 儿科 followup 层·随访记录（workbench/evidence/qc 三层仍待办）

## 结论

S03 儿科专科 followup 层新增随访记录首切：`pediatric_followup_record` 记录患儿随访计划与到访结果。随访闭环硬门：失访（未如期随访）必须附失访原因（数据库约束 `attended or no_show_reason 非空` + 服务端 `PEDIATRIC_FOLLOWUP_NO_SHOW_REASON_REQUIRED`）；随访原因非空；身份不可变。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。生长曲线百分位与危重升级联动未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| PF-001 | 如期随访 | attended=true 落库 | `givenAttendedFollowup_whenRecording_thenRecorded` |
| PF-002 | 失访附原因 | 接受 | `givenNoShowWithReason_whenRecording_thenAccepted` |
| PF-003 | 失访缺原因 | 拒绝 `PEDIATRIC_FOLLOWUP_NO_SHOW_REASON_REQUIRED` | `givenNoShowWithoutReason_whenRecording_thenRejected` |
| PF-004 | 随访篡改 | 不可变触发器拒绝 | `givenFollowup_whenTampered_thenDatabaseRejectsMutation` |

## 自动化门禁

```text
Java: 97 suites / 359 tests / 0 failure（+1 套件 +4 儿科随访测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 322 schemas / 330 generated outputs / 291 operations
Database: V1-V109 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V109__pediatric_followup_record.sql`：`pediatric_followup_record`（患者/就诊/院区/随访原因/计划日期/是否如期/失访原因/结果备注/记录者/记录时间、「失访必填原因」显式命名约束、身份不可变触发器、患者索引）。
- 新增 `PediatricFollowupService`/`Controller`/`ExceptionHandler`：`POST /pediatric-followup-records`（失访原因硬门 + 活动就诊校验 + 幂等）、`GET /pediatric-followup-records`；契约新增 2 个 Schema 与 2 个端点（322 schemas / 330 outputs / 291 operations）。

## 未关闭风险

- S03 儿科仅完成 record/care/followup 三层；workbench/evidence/qc 三层、生长曲线百分位与危重升级联动未实现，S01–S10 保持 `IN_PROGRESS`。
