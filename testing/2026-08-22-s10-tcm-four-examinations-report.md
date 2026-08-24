# S10 中医 evidence 层·四诊记录首切测试报告

日期：2026-08-22  
状态：`LOCAL_VERIFIED`（S01–S10 整体仍 `IN_PROGRESS`）  
范围：FR-138 / S10 中医 evidence 层·四诊记录（workbench/followup/qc 三层仍待办）

## 结论

S10 中医专科 evidence 层新增四诊记录首切：`tcm_four_examinations` 记录望闻问切四诊。四诊闭环硬门：望诊/闻诊/问诊/切诊四诊均必填非空（数据库逐列约束 + 服务端 `TCM_FOUR_EXAMINATIONS_REQUEST_INVALID`）；身份不可变。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。配伍禁忌与中西药相互作用未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| TFE-001 | 四诊完整记录 | 落库并列表可见 | `givenFourExaminations_whenRecording_thenRecorded` |
| TFE-002 | 缺望诊 | 拒绝 `TCM_FOUR_EXAMINATIONS_REQUEST_INVALID` | `givenMissingInspection_whenRecording_thenRejected` |
| TFE-003 | 缺切诊 | 拒绝 `TCM_FOUR_EXAMINATIONS_REQUEST_INVALID` | `givenMissingPalpation_whenRecording_thenRejected` |
| TFE-004 | 四诊篡改 | 不可变触发器拒绝 | `givenFourExaminations_whenTampered_thenDatabaseRejectsMutation` |

## 自动化门禁

```text
Java: 104 suites / 390 tests / 0 failure（+1 套件 +4 四诊记录测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 339 schemas / 347 generated outputs / 308 operations
Database: V1-V116 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V116__tcm_four_examinations.sql`：`tcm_four_examinations`（患者/就诊/院区/望诊/闻诊/问诊/切诊/四诊时间/记录者、「四诊均非空」逐列约束、身份不可变触发器、患者索引）。
- 新增 `TcmFourExaminationsService`/`Controller`/`ExceptionHandler`：`POST /tcm-four-examinations`（四诊完整硬门 + 活动就诊校验 + 幂等）、`GET /tcm-four-examinations`；契约新增 2 个 Schema 与 2 个端点（339 schemas / 347 outputs / 308 operations）。

## 未关闭风险

- S10 中医仅完成 record/treatment/evidence 三层；workbench/followup/qc 三层、配伍禁忌与中西药相互作用未实现，S01–S10 保持 `IN_PROGRESS`。
