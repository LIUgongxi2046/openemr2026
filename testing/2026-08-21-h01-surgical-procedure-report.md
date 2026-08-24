# H01 手术安全核查首切测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（H01 整体仍 `IN_PROGRESS`）  
范围：FR-045–049 / H01 手术·安全核查（麻醉/监护与真实血库仍待办）

## 结论

H01 手术域新增安全核查首切：`surgical_procedure` 记录术式名称、手术部位、术侧、主刀与麻醉医生，状态机 `SCHEDULED→TIME_OUT_COMPLETED→COMPLETED`。手术安全硬门：

- **术侧**：成对部位（上肢/下肢）必须指定侧别（数据库 `check` + 服务端双保险）；
- **人员分离**：主刀与麻醉医生必须不同（`check (surgeon_id <> anesthesiologist_id)`）；
- **time-out 门禁**：完成手术前必须已完成 time-out 安全核查（`SCHEDULED→TIME_OUT_COMPLETED→COMPLETED`，状态↔时间互锁）。

身份字段不可变，状态迁移走乐观锁。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。真实手术排台/植入物追溯、麻醉评估/术中事件/监护与真实血库未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| SP-001 | 排期→time-out→完成 | SCHEDULED→TIME_OUT_COMPLETED→COMPLETED | `SurgicalProcedureApiTest.givenProcedure_…` |
| SP-002 | 主刀与麻醉同一人 | 拒绝 `SURGICAL_PROCEDURE_REQUEST_INVALID` | `givenSameSurgeonAndAnesthesiologist_…` |
| SP-003 | 成对部位无侧别 | 拒绝 `SURGICAL_PROCEDURE_REQUEST_INVALID` | `givenPairedSiteWithoutLaterality_…` |
| SP-004 | 未 time-out 即完成 | 拒绝 `SURGICAL_PROCEDURE_STATE_INVALID` | `givenInvalidTransition_…` |
| SP-005 | 手术身份不可变 | 术式名称 UPDATE 被触发器拒绝 | `givenProcedureIdentity_whenTampered_…` |

## 自动化门禁

```text
Java: 61 suites / 198 tests / 0 failure（+1 套件 +5 手术测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 230 schemas / 238 generated outputs / 201 operations
Database: V1-V73 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V73__surgical_procedure.sql`：`surgical_procedure`（术式/部位/侧别、主刀/麻醉、「主刀与麻醉不同」与「成对部位必填侧别」硬约束、`SCHEDULED→TIME_OUT_COMPLETED→COMPLETED` 状态机与状态/时间一致性约束、身份不可变触发器、患者索引）。
- 新增 `SurgicalProcedureService`/`Controller`/`ExceptionHandler`：`POST /surgical-procedures`、`POST /surgical-procedures/{id}/transitions`（TIME_OUT/COMPLETE）、`GET /surgical-procedures`；契约新增 3 个 Schema 与 3 个端点（230 schemas / 238 outputs / 201 operations）。

## 未关闭风险

- H01 仅完成手术安全核查；真实手术排台/植入物追溯、麻醉评估/术中事件/监护与真实血库未实现，H01 保持 `IN_PROGRESS`。
