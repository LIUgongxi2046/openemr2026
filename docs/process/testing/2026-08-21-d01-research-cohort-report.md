# D01 研究队列首切测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（D01 整体仍 `IN_PROGRESS`）  
范围：FR-106–107 / D01 数据与科研·研究队列（队列统计与开源指标仍待办）

## 结论

D01 数据科研域新增研究队列首切：`research_cohort` 记录队列编码、名称、纳入标准与排除标准，状态 `ACTIVE/INACTIVE`。队列治理硬门：队列编码唯一且不可变（数据库唯一约束 + 触发器保护 cohort_code/inclusion_criteria/exclusion_criteria），纳入标准必填。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。真实队列成员计算、队列统计与开源指标未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| RC-001 | 定义并列表研究队列 | ACTIVE 队列正确 | `ResearchCohortApiTest.givenCohort_…` |
| RC-002 | 停用活动队列 | ACTIVE→INACTIVE | `givenActiveCohort_whenDeactivating_…` |
| RC-003 | 队列身份不可变 | 纳入标准 UPDATE 被触发器拒绝 | `givenCohortIdentity_whenTampered_…` |

## 自动化门禁

```text
Java: 69 suites / 228 tests / 0 failure（+1 套件 +3 研究队列测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 254 schemas / 262 generated outputs / 225 operations
Database: V1-V81 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V81__research_cohort.sql`：`research_cohort`（队列编码/名称/纳入标准/排除标准、`ACTIVE/INACTIVE`、编码唯一 + 身份不可变触发器、状态索引）。
- 新增 `ResearchCohortService`/`Controller`/`ExceptionHandler`：`POST /research-cohorts`、`POST /research-cohorts/{id}/deactivations`、`GET /research-cohorts`（可按状态过滤）；契约新增 3 个 Schema 与 3 个端点（254 schemas / 262 outputs / 225 operations）。

## 未关闭风险

- D01 仅完成研究队列；真实队列成员计算、队列统计与开源指标未实现，D01 保持 `IN_PROGRESS`。
