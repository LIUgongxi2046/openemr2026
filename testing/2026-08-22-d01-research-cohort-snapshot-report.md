# D01 研究队列成员快照首切测试报告

日期：2026-08-22  
状态：`LOCAL_VERIFIED`（D01 整体仍 `IN_PROGRESS`）  
范围：FR-029/054/055/106/107 / D01 数据中心·科研统计与开源指标（队列成员快照；真实成员计算与开源指标仍待办）

## 结论

D01 科研统计新增队列成员快照首切：`research_cohort_snapshot` 记录某研究队列的成员数统计快照。可复算闭环硬门：`criteria_hash` 由服务端对「租户+队列+纳入标准+排除标准」计算（不由调用方指定），使快照与队列当前标准不可伪造地绑定；`member_count >= 0` 数据库约束；仅 `ACTIVE` 队列可快照（`RESEARCH_COHORT_INACTIVE`）；快照整体不可变。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。真实成员计算引擎、统计口径与开源指标未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| RCS-001 | 活动队列记录快照 | member_count 落库，criteria_hash 64 位 | `givenActiveCohort_whenRecording_thenSnapshotWithCriteriaHash` |
| RCS-002 | 停用队列记录快照 | 拒绝 `RESEARCH_COHORT_INACTIVE` | `givenInactiveCohort_whenRecording_thenRejected` |
| RCS-003 | 负成员数 | 拒绝 `RESEARCH_COHORT_SNAPSHOT_REQUEST_INVALID` | `givenNegativeMemberCount_whenRecording_thenRejected` |
| RCS-004 | 绕过服务写负成员数 | 数据库约束拒绝 | `givenNegativeMemberCount_whenBypassingService_thenDatabaseRejects` |
| RCS-005 | 快照篡改 | 不可变触发器拒绝 | `givenSnapshot_whenTampered_thenDatabaseRejectsMutation` |

## 自动化门禁

```text
Java: 83 suites / 292 tests / 0 failure（+1 套件 +5 队列成员快照测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 292 schemas / 300 generated outputs / 262 operations
Database: V1-V95 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V95__research_cohort_snapshot.sql`：`research_cohort_snapshot`（队列外键/成员数/标准哈希/计算时间与人员、「成员数非负」「标准哈希 64 位」显式命名约束、整体不可变触发器、队列索引）。
- 新增 `ResearchCohortSnapshotService`/`Controller`/`ExceptionHandler`：`POST /research-cohort-snapshots`（标准哈希服务端计算 + 仅 ACTIVE 队列可快照 + 幂等）、`GET /research-cohort-snapshots`；契约新增 2 个 Schema 与 2 个端点（292 schemas / 300 outputs / 262 operations）。

## 未关闭风险

- D01 仅完成队列成员快照；真实成员计算引擎、队列统计口径与开源指标（Stars/有效下载）未实现，D01 保持 `IN_PROGRESS`。
