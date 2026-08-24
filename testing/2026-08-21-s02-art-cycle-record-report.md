# S02 生殖专科·ART 周期记录首切测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（S01–S10 专科包整体仍 `IN_PROGRESS`）  
范围：FR-130 / S02 生殖（record 层首切）

## 结论

生殖专科包 record 层首切落地：`art_cycle_record` 记录女方/男方、周期类型（IVF/ICSI/IUI/FET）、周期序号、伦理同意日期与同意文书；伦理同意日期不可晚于当前（硬门），配偶不可为同一患者；身份字段创建后不可篡改。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。配子/胚胎追溯、双人核验与库存未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| AR-001 | 创建并列表 ART 周期 | 周期类型/同意日期/配偶正确 | `ArtCycleApiTest.givenReproductivePatient_…` |
| AR-002 | 未来伦理同意日期 | 拒绝 | `givenFutureConsentDate_…` |
| AR-003 | 自己作为配偶 | 拒绝 | `givenSelfAsPartner_…` |
| AR-004 | 周期身份不可变 | 周期序号 UPDATE 被触发器拒绝 | `givenCycleIdentity_whenTampered_…` |

## 自动化门禁

```text
Java: 47 suites / 140 tests / 0 failure（+1 套件 +4 ART 周期测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 198 schemas / 206 generated outputs / 117 operations
Database: V1-V57 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V57__art_cycle_record.sql`：`art_cycle_record`（女方/男方、周期类型/序号、伦理同意日期与文书、身份不可变触发器、患者索引）。
- 新增 `ArtCycleService`/`Controller`/`ExceptionHandler`：`POST /art-cycle-records`、`GET /art-cycle-records`；契约新增 2 个 Schema。

## 未关闭风险

- S02 仅完成 record 层；配子/胚胎追溯、双人核验、伦理同意文档与库存六层未实现，S01–S10 保持 `IN_PROGRESS`。
