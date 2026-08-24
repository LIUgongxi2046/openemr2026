# S05 精神心理 followup 层·危机干预随访记录首切测试报告

日期：2026-08-22  
状态：`LOCAL_VERIFIED`（S01–S10 整体仍 `IN_PROGRESS`）  
范围：FR-133 / S05 精神心理 followup 层·危机干预随访（workbench/evidence/qc 三层仍待办）

## 结论

S05 精神心理专科 followup 层新增危机干预随访记录首切：`mental_health_crisis_followup` 记录危机患者随访时的风险再评估。随访闭环硬门：数据密级强制 `RESTRICTED`（数据库约束）；高风险/即刻风险必须附保护措施（数据库约束 `risk_level not in (HIGH,IMMINENT) or protective_measures 非空` + 服务端 `MENTAL_HEALTH_CRISIS_FOLLOWUP_PROTECTION_REQUIRED`）；身份不可变。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。保护性约束执行与跨机构危机上报未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| MCF-001 | 低风险随访 | 落库，密级 RESTRICTED | `givenLowRiskFollowup_whenRecording_thenRecorded` |
| MCF-002 | 高风险附保护措施 | 接受 | `givenHighRiskWithMeasures_whenRecording_thenAccepted` |
| MCF-003 | 高风险缺保护措施 | 拒绝 `MENTAL_HEALTH_CRISIS_FOLLOWUP_PROTECTION_REQUIRED` | `givenHighRiskWithoutMeasures_whenRecording_thenRejected` |
| MCF-004 | 随访篡改 | 不可变触发器拒绝 | `givenFollowup_whenTampered_thenDatabaseRejectsMutation` |

## 自动化门禁

```text
Java: 107 suites / 404 tests / 0 failure（+1 套件 +4 危机干预随访测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 345 schemas / 353 generated outputs / 314 operations
Database: V1-V119 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V119__mental_health_crisis_followup.sql`：`mental_health_crisis_followup`（患者/就诊/院区/随访日期/风险等级 NONE·LOW·MODERATE·HIGH·IMMINENT/保护措施/密级 RESTRICTED/记录者/记录时间、「高风险必附保护措施」显式命名约束、身份不可变触发器、患者索引）。
- 新增 `MentalHealthCrisisFollowupService`/`Controller`/`ExceptionHandler`：`POST /mental-health-crisis-followups`（高风险保护措施硬门 + 活动就诊校验 + 幂等）、`GET /mental-health-crisis-followups`；契约新增 2 个 Schema 与 2 个端点（345 schemas / 353 outputs / 314 operations）。

## 未关闭风险

- S05 精神心理仅完成 record/care/followup 三层；workbench/evidence/qc 三层、保护性约束执行与跨机构危机上报未实现，S01–S10 保持 `IN_PROGRESS`。
