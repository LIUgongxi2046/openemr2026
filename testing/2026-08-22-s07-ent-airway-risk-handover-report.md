# S07 耳鼻喉 care 层·气道风险交接记录首切测试报告

日期：2026-08-22  
状态：`LOCAL_VERIFIED`（S01–S10 整体仍 `IN_PROGRESS`）  
范围：FR-135 / S07 耳鼻喉 care 层·气道风险交接（workbench/evidence/treatment/followup/qc 五层仍待办）

## 结论

S07 耳鼻喉专科 care 层新增气道风险交接记录首切：`ent_airway_risk_handover` 记录中/高气道风险患者由交接方转交接收方的交接事件。交接闭环硬门：仅 `MODERATE`/`HIGH` 气道风险可交接（数据库约束）；交接必须附防护措施（`airway_precautions` 非空，数据库约束 + 服务端）；交接双方分离（`from_provider_id <> to_provider_id` + `SELF_HANDOVER_FORBIDDEN`）；身份不可变。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。真实听力/内镜与标本来源未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| EARH-001 | 高风险气道交接 | 落库，交接双方落库 | `givenHandover_whenRecording_thenRecorded` |
| EARH-002 | 交接给自己 | 拒绝 `SELF_HANDOVER_FORBIDDEN` | `givenSelfHandover_whenRecording_thenRejected` |
| EARH-003 | 绕过服务同人交接 | 数据库约束拒绝 | `givenSameProviderBypass_whenInserting_thenDatabaseRejects` |
| EARH-004 | 交接篡改 | 不可变触发器拒绝 | `givenHandover_whenTampered_thenDatabaseRejectsMutation` |

## 自动化门禁

```text
Java: 93 suites / 344 tests / 0 failure（+1 套件 +4 气道风险交接测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 314 schemas / 322 generated outputs / 284 operations
Database: V1-V105 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V105__ent_airway_risk_handover.sql`：`ent_airway_risk_handover`（患者/就诊/院区/气道风险等级 MODERATE·HIGH/防护措施/交接双方/交接时间、「交接双方分离」显式命名约束、身份不可变触发器、患者索引）。
- 新增 `EntAirwayRiskHandoverService`/`Controller`/`ExceptionHandler`：`POST /ent-airway-risk-handovers`（自交接硬门 + 防护措施必填 + 活动就诊校验 + 幂等）、`GET /ent-airway-risk-handovers`；契约新增 2 个 Schema 与 2 个端点（314 schemas / 322 outputs / 284 operations）。

## 未关闭风险

- S07 耳鼻喉仅完成 record 层与 care 层气道风险交接；workbench/evidence/treatment/followup/qc 五层、真实听力/内镜与标本来源未实现，S01–S10 保持 `IN_PROGRESS`。
