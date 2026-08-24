# W01 不良事件上报与复核首切测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（W01 整体仍 `IN_PROGRESS`）  
范围：FR-092 / W01 不良事件

## 结论

不良事件上报与复核首切落地：`adverse_event` 记录事件类型（用药错误/跌倒/压疮/输血反应/手术并发症/感染/其他）、严重程度（接近差错/轻/中/重/警讯）、描述与状态机 `REPORTED→REVIEWED/CLOSED`；上报内容/患者/就诊创建后不可篡改；复核记录结论并可选择关闭。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。真实上报渠道、根因分析（RCA）与院感/传染病监测未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| AE-001 | 上报并复核关闭 | `REPORTED→CLOSED`，结论/关闭时间正确 | `AdverseEventApiTest.givenActiveEncounter_…` |
| AE-002 | 上报内容不可变 | 严重程度 UPDATE 被触发器拒绝 | `givenAdverseEventReport_whenTampered_…` |

## 自动化门禁

```text
Java: 40 suites / 118 tests / 0 failure（+1 套件 +2 不良事件测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 176 schemas / 184 generated outputs / 117 operations
Database: V1-V49 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V49__adverse_event.sql`：`adverse_event`（事件类型/严重程度/描述、状态机 `REPORTED→REVIEWED/CLOSED`、内容不可变触发器、就诊索引）。
- 新增 `AdverseEventService`/`Controller`/`ExceptionHandler`：`POST /adverse-events`、`POST /adverse-events/{id}/reviews`、`GET /adverse-events`；契约新增 3 个 Schema。

## 未关闭风险

- 未接真实上报渠道（国家医疗安全不良事件系统）、根因分析（RCA）与整改闭环。
- 院感/传染病监测线索、转诊摘要仍未实现，W01 保持 `IN_PROGRESS`。
