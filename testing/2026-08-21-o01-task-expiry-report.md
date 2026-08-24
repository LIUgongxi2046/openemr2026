# O01 统一临床任务过期测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（O01 整体仍 `IN_PROGRESS`）  
范围：FR-095 / O01 任务过期

## 结论

统一临床任务新增确定性的「过期」收口命令：就诊内所有 `due_at` 已过且仍处于非终态（`PENDING/ASSIGNED/DELIVERED/VIEWED/CLAIMED/IN_PROGRESS/ESCALATED`）的任务，可一次性转入 `EXPIRED`，逐条追加不可变 `EXPIRED` 事件与审计/Outbox 证据，并返回过期数量；重复执行幂等，已过期任务不再计入。

这一结论只适用于本机合成数据。真实定时调度、通知投递与团队视图未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| TE-001 | 有过期任务 | 一次转入 `EXPIRED`，返回 `expired_count=1`，追加 `EXPIRED` 事件且 `previous_state=PENDING` | `ClinicalTaskApiTest.givenOverdueTask_…` |
| TE-002 | 重复执行 | 幂等，`expired_count=0`，不产生重复事件 | 同一测试后半段 |
| TE-003 | 终态任务不受影响 | `COMPLETED/WITHDRAWN/EXPIRED` 不再被扫描 | 服务端 `state not in (...)` 过滤 |

## 自动化门禁

```text
Java: 32 suites / 89 tests / 0 failure（+1 任务过期测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 145 schemas / 153 generated outputs / 117 operations
Database: V1-V39 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 契约新增 `ClinicalTaskExpirationResult`（`expired_count`/`encounter_id`/`occurred_at`）与 `POST /clinical-tasks/expirations` 端点。
- `ClinicalTaskService.expireOverdueTasks`：在单事务内 `for update` 锁定就诊内过期非终态任务，逐条转 `EXPIRED`、追加 `EXPIRED` 事件与审计/Outbox，返回过期数量；复用现有 `due_at`、`EXPIRED` 状态与事件类型，无需新增迁移。

## 未关闭风险

- 当前为命令驱动的手工/调用触发，未接入定时调度器、告警通知与「通知恢复」（Outbox 通知投递失败重试）闭环。
- 团队视图（按病区/科室/团队聚合任务队列）仍未实现。
- 儿童/肝肾剂量、文书/会诊/路径/出院/Agent 等任务来源仍未完成。
