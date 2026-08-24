# Q01 数据质量评估执行首切测试报告

日期：2026-08-22  
状态：`LOCAL_VERIFIED`（Q01 整体仍 `IN_PROGRESS`）  
范围：FR-054/061/105 / Q01 病案资产·数据质量·评级取证（质量评估执行；评级取证与历史迁移仍待办）

## 结论

Q01 数据质量新增评估执行首切：`data_quality_evaluation` 记录对某目标实体实例执行一条 `data_quality_rule` 的评估结果。执行闭环硬门：`PASSED/FAILED` 结论必须与实测值相对阈值一致（数据库约束 `(status='PASSED') = (measured_value >= threshold)`）；阈值从规则快照、不由调用方指定（防篡改）；实测值/阈值均须落在 0–1；仅 `ACTIVE` 规则可被执行（`DATA_QUALITY_RULE_INACTIVE`）；评估记录整体不可变。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。真实数据源的质量扫描调度、评级取证与历史迁移未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| DQE-001 | 实测值高于阈值 | PASSED，阈值取自规则快照 | `givenMeasuredAboveThreshold_whenRecording_thenPassedWithRuleThreshold` |
| DQE-002 | 实测值低于阈值 | FAILED | `givenMeasuredBelowThreshold_whenRecording_thenFailed` |
| DQE-003 | 停用规则执行 | 拒绝 `DATA_QUALITY_RULE_INACTIVE` | `givenInactiveRule_whenRecording_thenRejected` |
| DQE-004 | 实测值越界 | 拒绝 `DATA_QUALITY_EVALUATION_REQUEST_INVALID` | `givenOutOfRangeMeasured_whenRecording_thenRejected` |
| DQE-005 | 绕过服务写不一致结论 | 数据库约束拒绝 | `givenInconsistentPassed_whenBypassingService_thenDatabaseRejects` |
| DQE-006 | 评估记录篡改 | 不可变触发器拒绝 | `givenEvaluation_whenTampered_thenDatabaseRejectsMutation` |

## 自动化门禁

```text
Java: 81 suites / 279 tests / 0 failure（+1 套件 +6 数据质量评估测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 288 schemas / 296 generated outputs / 258 operations
Database: V1-V93 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V93__data_quality_evaluation.sql`：`data_quality_evaluation`（规则/目标实体/实测值/阈值快照/结论、`PASSED/FAILED` 状态、「结论与阈值一致」与「实测值/阈值 0–1」显式命名数据库约束、整体不可变触发器、规则索引）。
- 新增 `DataQualityEvaluationService`/`Controller`/`ExceptionHandler`：`POST /data-quality-evaluations`（阈值取规则快照 + 仅 ACTIVE 规则可执行 + 幂等）、`GET /data-quality-evaluations`；契约新增 2 个 Schema 与 2 个端点（288 schemas / 296 outputs / 258 operations）。

## 未关闭风险

- Q01 仅完成数据质量评估执行；评级取证、历史迁移（试迁/增量/对账/回退）与病案资产全生命周期未实现，Q01 保持 `IN_PROGRESS`。
