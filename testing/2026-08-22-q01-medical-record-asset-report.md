# Q01 病案资产编目与借阅闭环首切测试报告

日期：2026-08-22  
状态：`LOCAL_VERIFIED`（Q01 整体仍 `IN_PROGRESS`）  
范围：FR-038/094 / Q01 病案资产·数据质量·评级取证（病案资产编目/借阅/归还；评级取证与历史迁移仍待办）

## 结论

Q01 病案资产新增编目与借阅闭环首切：`medical_record_asset` 记录病案的纸质/扫描/电子资产编目（类型、保管位置、内容完整性哈希），状态机 `ARCHIVED⇄BORROWED`。闭环硬门：借阅仅允许 `ARCHIVED` 且借期须在未来（`MEDICAL_RECORD_ASSET_STATE_INVALID`/`REQUEST_INVALID`）；归还仅允许 `BORROWED`（清空借阅人/时间/到期）；借阅状态与借阅人/时间/到期强一致（数据库约束 `(status='BORROWED') = (borrowed_by/borrowed_at/due_at 非空)`）；内容完整性哈希 64 位（数据库约束 + 服务端校验）；身份与哈希不可变。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。真实扫描件内容校验与评级取证/历史迁移未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| MRA-001 | 编目并列表 | ARCHIVED + 哈希 64 位 | `givenAsset_whenRegisteringAndListing_thenArchived` |
| MRA-002 | 归档资产借阅 | ARCHIVED→BORROWED，借阅人/到期落库 | `givenArchivedAsset_whenBorrowing_thenBorrowed` |
| MRA-003 | 借出资产归还 | BORROWED→ARCHIVED，借阅人清空 | `givenBorrowedAsset_whenReturning_thenArchived` |
| MRA-004 | 借出资产重复借阅 | 拒绝 `MEDICAL_RECORD_ASSET_STATE_INVALID` | `givenBorrowedAsset_whenBorrowingAgain_thenRejected` |
| MRA-005 | 过期行版本借阅 | 拒绝 `MEDICAL_RECORD_ASSET_VERSION_CONFLICT` | `givenStaleVersion_whenBorrowing_thenRejected` |
| MRA-006 | 借期在过去 | 拒绝 `MEDICAL_RECORD_ASSET_REQUEST_INVALID` | `givenPastDueAt_whenBorrowing_thenRejected` |
| MRA-007 | 内容哈希篡改 | 不可变触发器拒绝 | `givenAssetIdentity_whenTampered_thenDatabaseRejectsMutation` |

## 自动化门禁

```text
Java: 85 suites / 304 tests / 0 failure（+1 套件 +7 病案资产测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 298 schemas / 306 generated outputs / 268 operations
Database: V1-V97 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V97__medical_record_asset.sql`：`medical_record_asset`（患者/就诊/类型 PAPER·SCAN·DIGITAL/保管位置/内容哈希、`ARCHIVED⇄BORROWED` 状态机、「内容哈希 64 位」「借阅状态与借阅人/时间/到期一致」显式命名约束、身份不可变触发器、患者索引）。
- 新增 `MedicalRecordAssetService`/`Controller`/`ExceptionHandler`：`POST /medical-record-assets`（编目）、`POST /medical-record-assets/{id}/borrows`（借阅，乐观锁 + 仅 ARCHIVED）、`POST /medical-record-assets/{id}/returns`（归还，仅 BORROWED）、`GET /medical-record-assets`；契约新增 4 个 Schema 与 4 个端点（298 schemas / 306 outputs / 268 operations）。

## 未关闭风险

- Q01 仅完成病案资产编目与借阅闭环；真实扫描件内容校验、评级取证与历史迁移（试迁/增量/对账/回退）未实现，Q01 保持 `IN_PROGRESS`。
