# W01 院感监测线索首切测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（W01 整体仍 `IN_PROGRESS`）  
范围：FR-051/052/092 / W01 院感监测（真实上报渠道/RCA 与转诊摘要仍待办）

## 结论

W01 质量安全域新增院感监测线索首切：`infection_monitoring_event` 记录感染类型（切口/尿路/血流/肺炎/其他）、病原体编码与上报时间，状态机 `REPORTED→CONFIRMED/REFUTED`。院感处置硬门：线索必须由人工明确确认或排除（`CONFIRMED`/`REFUTED`），且确认/排除必须给出结论（数据库约束 `(status in ('CONFIRMED','REFUTED')) = (conclusion is not null …)` + `= (resolved_at is not null)`），体现「规则只生线索不自动确诊」。身份字段（患者/就诊/感染类型/病原体/上报时间）不可变，处置走乐观锁。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。真实上报渠道/RCA、院感暴发监测与转诊摘要未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| IE-001 | 上报线索并确认 | REPORTED→CONFIRMED | `InfectionEventApiTest.givenReportedClue_whenConfirming_…` |
| IE-002 | 上报线索并排除 | REPORTED→REFUTED | `givenReportedClue_whenRefuting_…` |
| IE-003 | 已处置线索重复处置 | 拒绝 `INFECTION_EVENT_STATE_INVALID` | `givenResolvedEvent_whenResolvingAgain_…` |
| IE-004 | 线索身份不可变 | 感染类型 UPDATE 被触发器拒绝 | `givenEventIdentity_whenTampered_…` |

## 自动化门禁

```text
Java: 62 suites / 202 tests / 0 failure（+1 套件 +4 院感监测测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 233 schemas / 241 generated outputs / 204 operations
Database: V1-V74 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V74__infection_monitoring.sql`：`infection_monitoring_event`（感染类型/病原体/上报时间、`REPORTED→CONFIRMED/REFUTED` 状态机、「确认/排除必填结论」与状态/时间一致性约束、身份不可变触发器、患者索引）。
- 新增 `InfectionEventService`/`Controller`/`ExceptionHandler`：`POST /infection-monitoring-events`、`POST /infection-monitoring-events/{id}/resolutions`（CONFIRM/REFUTE）、`GET /infection-monitoring-events`；契约新增 3 个 Schema 与 3 个端点（233 schemas / 241 outputs / 204 operations）。

## 未关闭风险

- W01 仅完成院感监测线索；真实上报渠道/RCA、院感暴发监测与转诊摘要未实现，W01 保持 `IN_PROGRESS`。
