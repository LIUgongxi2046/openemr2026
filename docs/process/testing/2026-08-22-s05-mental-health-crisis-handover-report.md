# S05 精神心理 care 层·危机交接记录首切测试报告

日期：2026-08-22  
状态：`LOCAL_VERIFIED`（S01–S10 整体仍 `IN_PROGRESS`）  
范围：FR-133 / S05 精神心理 care 层·危机交接（workbench/evidence/treatment/followup/qc 五层仍待办）

## 结论

S05 精神心理专科 care 层新增危机交接记录首切：`mental_health_crisis_handover` 记录精神心理危机患者由交接方转交接收方的交接事件。危机交接闭环硬门：数据密级强制 `RESTRICTED`（数据库约束 + 服务端）；高风险/即刻风险必须附保护措施（`CRISIS_PROTECTIVE_MEASURES_REQUIRED` + 数据库约束 `risk_level in (HIGH,IMMINENT) ⟹ protective_measures 非空`）；交接双方分离（`from_provider_id <> to_provider_id` + `SELF_HANDOVER_FORBIDDEN`）；交接方为当前操作者；身份不可变。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。保护性约束执行与跨机构危机上报未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| MCH-001 | 低风险危机交接 | 落库，密级 RESTRICTED，交接双方落库 | `givenCrisisHandover_whenRecording_thenRecorded` |
| MCH-002 | 高风险无保护措施 | 拒绝 `CRISIS_PROTECTIVE_MEASURES_REQUIRED` | `givenHighRiskWithoutMeasures_whenRecording_thenRejected` |
| MCH-003 | 高风险附保护措施 | 接受 | `givenHighRiskWithMeasures_whenRecording_thenAccepted` |
| MCH-004 | 交接给自己 | 拒绝 `SELF_HANDOVER_FORBIDDEN` | `givenSelfHandover_whenRecording_thenRejected` |
| MCH-005 | 交接篡改 | 不可变触发器拒绝 | `givenHandover_whenTampered_thenDatabaseRejectsMutation` |

## 自动化门禁

```text
Java: 87 suites / 316 tests / 0 failure（+1 套件 +5 危机交接测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 302 schemas / 310 generated outputs / 272 operations
Database: V1-V99 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V99__mental_health_crisis_handover.sql`：`mental_health_crisis_handover`（患者/就诊/交接双方/危机原因/风险等级/保护措施/密级 RESTRICTED/交接时间、「交接双方分离」「高风险必附保护措施」显式命名约束、身份不可变触发器、患者索引）。
- 新增 `MentalHealthCrisisHandoverService`/`Controller`/`ExceptionHandler`：`POST /mental-health-crisis-handovers`（自交接/保护措施硬门 + 活动就诊校验 + 幂等）、`GET /mental-health-crisis-handovers`；契约新增 2 个 Schema 与 2 个端点（302 schemas / 310 outputs / 272 operations）。

## 未关闭风险

- S05 精神心理仅完成 record 层与 care 层危机交接；workbench/evidence/treatment/followup/qc 五层、保护性约束执行与跨机构危机上报未实现，S01–S10 保持 `IN_PROGRESS`。
