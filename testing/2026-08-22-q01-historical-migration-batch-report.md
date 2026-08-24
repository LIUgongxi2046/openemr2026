# Q01 历史迁移批次首切测试报告

日期：2026-08-22  
状态：`LOCAL_VERIFIED`（Q01 整体仍 `IN_PROGRESS`）  
范围：FR-038/094 / Q01 病案资产·历史迁移（评级取证仍待办）

## 结论

Q01 历史迁移新增迁移批次首切：`historical_migration_batch` 记录历史数据从源系统迁入的批次（试迁/对账/切换/回退）。迁移闭环硬门：切换（SWITCHED）必须对账一致（`mismatch_count = 0`，数据库约束 + 服务端 `HISTORICAL_MIGRATION_MISMATCH`）；状态机 `TRIAL→RECONCILED→SWITCHED/ROLLED_BACK`（仅试迁可对账、仅已对账可切换/回退）；对账后记录 `completed_at`（数据库约束）；记录数/差异数非负；身份不可变；乐观锁防并发。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。真实源系统盘点、患者匹配与断点重跑未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| HMB-001 | 启动迁移批次 | TRIAL 落库，mismatch=0 | `givenBatch_whenStarting_thenTrial` |
| HMB-002 | 试迁对账 | TRIAL→RECONCILED，completed_at 落库 | `givenTrialBatch_whenReconciling_thenReconciled` |
| HMB-003 | 对账一致切换 | RECONCILED→SWITCHED | `givenReconciledBatch_whenSwitching_thenSwitched` |
| HMB-004 | 对账不一致切换 | 拒绝 `HISTORICAL_MIGRATION_MISMATCH` | `givenReconciledWithMismatch_whenSwitching_thenRejected` |
| HMB-005 | 对账后回退 | RECONCILED→ROLLED_BACK | `givenReconciledBatch_whenRollingBack_thenRolledBack` |
| HMB-006 | 过期行版本对账 | 拒绝 `HISTORICAL_MIGRATION_VERSION_CONFLICT` | `givenStaleVersion_whenReconciling_thenRejected` |

## 自动化门禁

```text
Java: 103 suites / 386 tests / 0 failure（+1 套件 +6 历史迁移批次测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 337 schemas / 345 generated outputs / 306 operations
Database: V1-V115 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V115__historical_migration_batch.sql`：`historical_migration_batch`（源系统/批次状态 TRIAL·RECONCILED·SWITCHED·ROLLED_BACK/记录数/差异数/开始/完成时间/创建者、「切换须对账一致」「对账后必录完成时间」显式命名约束、身份不可变触发器、源系统索引）。
- 新增 `HistoricalMigrationBatchService`/`Controller`/`ExceptionHandler`：`POST /historical-migration-batches`（试迁）、`.../{id}/reconciliations`（对账）、`.../{id}/switches`（切换）、`.../{id}/rollbacks`（回退）、`GET /historical-migration-batches`；契约新增 5 个 Schema 与 5 个端点（337 schemas / 345 outputs / 306 operations）。

## 未关闭风险

- Q01 仅完成历史迁移批次状态机；真实源系统盘点、患者匹配、断点重跑与评级取证未实现，Q01 保持 `IN_PROGRESS`。
