# Q01 数据质量规则首切测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（Q01 整体仍 `IN_PROGRESS`）  
范围：FR-105/125 / Q01 数据质量·数据质量规则（评级取证与历史迁移仍待办）

## 结论

Q01 数据质量域新增数据质量规则首切：`data_quality_rule` 记录规则编码、规则名、质量维度（完整性/一致性/时效性/唯一性/有效性）、目标实体、达标阈值（0–1）与严重度（INFO/WARNING/BLOCKING），状态 `ACTIVE/INACTIVE`。规则治理硬门：规则编码唯一且不可变（数据库唯一约束 + 触发器保护 rule_code/dimension/target_entity/threshold/severity），阈值必须在 0–1 范围（数据库 `check` + 服务端双保险）。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。质量评估执行、评级取证、历史迁移与真实数据规模未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| DQ-001 | 登记并列表数据质量规则 | ACTIVE 规则正确 | `DataQualityRuleApiTest.givenRule_…` |
| DQ-002 | 停用活动规则 | ACTIVE→INACTIVE | `givenActiveRule_whenDeactivating_…` |
| DQ-003 | 阈值越界（1.5） | 拒绝 `DATA_QUALITY_RULE_REQUEST_INVALID` | `givenOutOfRangeThreshold_…` |
| DQ-004 | 规则身份不可变 | 阈值 UPDATE 被触发器拒绝 | `givenRuleIdentity_whenTampered_…` |

## 自动化门禁

```text
Java: 65 suites / 215 tests / 0 failure（+1 套件 +4 数据质量规则测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 242 schemas / 250 generated outputs / 213 operations
Database: V1-V77 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V77__data_quality_rule.sql`：`data_quality_rule`（规则编码/维度/目标实体/阈值/严重度、`ACTIVE/INACTIVE`、编码唯一 + 身份不可变触发器、维度索引）。
- 新增 `DataQualityRuleService`/`Controller`/`ExceptionHandler`：`POST /data-quality-rules`、`POST /data-quality-rules/{id}/deactivations`、`GET /data-quality-rules`（可按维度过滤）；契约新增 3 个 Schema 与 3 个端点（242 schemas / 250 outputs / 213 operations）。

## 未关闭风险

- Q01 仅完成数据质量规则；质量评估执行、评级取证与历史迁移未实现，Q01 保持 `IN_PROGRESS`。
