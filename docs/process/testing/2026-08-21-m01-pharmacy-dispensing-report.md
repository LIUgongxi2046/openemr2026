# M01 药房发药双人核验首切测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（M01 整体仍 `IN_PROGRESS`）  
范围：FR-040/041/042 / M01 药房·发药双人核验（支付/预交/结算、库存与审方/调剂仍待办）

## 结论

M01 药房新增发药双人核验首切：`pharmacy_dispensing` 记录药品编码、批次号、发药数量/单位、发药人与核对人，状态机 `PREPARED→VERIFIED→DISPENSED`。发药安全硬门：发药与核对必须为不同人员（数据库 `check (verified_by is null or verified_by <> dispensed_by)` + 服务端 `PHARMACY_SELF_VERIFICATION_FORBIDDEN`）；批次号/药品编码必填、数量必须为正；状态/时间一致性（`verified_at ≥ prepared_at`、`dispensed_at ≥ verified_at`、状态↔时间互锁）由数据库约束保证。身份字段（患者/药品/批次/数量/发药人）不可变，状态迁移走乐观锁。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。库存扣减、审方/调剂、支付/预交/结算与真实药房库存未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| PD-001 | 配药→核对→发药闭环 | PREPARED→VERIFIED→DISPENSED | `PharmacyDispensingApiTest.givenDispensing_…` |
| PD-002 | 同一人配药并核对 | 拒绝 `PHARMACY_SELF_VERIFICATION_FORBIDDEN` | `givenSameUser_whenVerifying_…` |
| PD-003 | 未核对即发药 | 拒绝 `PHARMACY_DISPENSING_STATE_INVALID` | `givenInvalidTransition_…` |
| PD-004 | 发药身份不可变 | 批次号 UPDATE 被触发器拒绝 | `givenDispensingIdentity_whenTampered_…` |

## 自动化门禁

```text
Java: 60 suites / 193 tests / 0 failure（+1 套件 +4 药房发药测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 227 schemas / 235 generated outputs / 198 operations
Database: V1-V72 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V72__pharmacy_dispensing.sql`：`pharmacy_dispensing`（药品/批次/数量/单位、发药人/核对人、「发药人与核对人不同」双人核验约束、`PREPARED→VERIFIED→DISPENSED` 状态机与状态/时间一致性约束、身份不可变触发器、患者索引）。
- 新增 `PharmacyDispensingService`/`Controller`/`ExceptionHandler`：`POST /pharmacy-dispensings`、`POST /pharmacy-dispensings/{id}/transitions`（VERIFY/DISPENSE）、`GET /pharmacy-dispensings`；契约新增 3 个 Schema 与 3 个端点（227 schemas / 235 outputs / 198 operations）。

## 未关闭风险

- M01 仅完成发药双人核验；库存扣减、审方/调剂、支付/预交/结算未实现，M01 保持 `IN_PROGRESS`。
