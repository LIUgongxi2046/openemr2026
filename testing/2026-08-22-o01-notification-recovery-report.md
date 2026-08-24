# O01 统一任务通知投递与恢复首切测试报告

日期：2026-08-22  
状态：`LOCAL_VERIFIED`（O01 整体仍 `IN_PROGRESS`）  
范围：FR-034/035 / O01 诊断·医嘱·执行与结果任务内核·统一任务消息（通知投递恢复；科室级任务队列/团队视图仍待办）

## 结论

O01 统一任务消息新增通知投递与恢复首切：`clinical_task_notification` 记录某统一临床任务（`clinical_task`）的收件人通知，覆盖创建/逾期/升级/过期四类通知与 `IN_APP`/`OUTBOX` 两种投递渠道，状态机 `PENDING→DELIVERED/FAILED`。投递闭环硬门：`DELIVERED` 必含投递时间、`FAILED` 必含失败原因（数据库约束 `(status='DELIVERED') = (delivered_at is not null)` + `(status='FAILED') = (last_error is not null)`）；身份（任务/收件人/类型/渠道）不可变。恢复硬门：仅 `FAILED` 可重投（`FAILED→PENDING`），重投清空失败原因并单调递增 `attempt_count`，`DELIVERED` 通知不受影响；全部投递与恢复写入事件/审计/Outbox 同事务。

这一结论只适用于本机合成数据。真实消息通道（SSE/推送）与定时投递调度未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| TN-001 | 创建并列表通知 | PENDING，attempt_count=0 | `givenNotification_whenCreatingAndListing_thenPending` |
| TN-002 | 待投递通知投递成功 | PENDING→DELIVERED，delivered_at 落库 | `givenPendingNotification_whenDelivering_thenDelivered` |
| TN-003 | 过期行版本投递 | 拒绝 `TASK_NOTIFICATION_VERSION_CONFLICT` | `givenStaleVersion_whenDelivering_thenRejected` |
| TN-004 | 待投递通知投递失败 | PENDING→FAILED，last_error 落库 | `givenPendingNotification_whenFailing_thenFailedWithError` |
| TN-005 | 失败通知恢复重投 | FAILED→PENDING，attempt_count+1，可再次投递 | `givenFailedNotification_whenRecovering_thenRequeuedWithAttemptIncrement` |
| TN-006 | 已投递通知不被恢复 | recovered_count=0 | `givenDeliveredNotification_whenRecovering_thenUntouched` |
| TN-007 | 通知身份篡改 | 不可变触发器拒绝 | `givenNotificationIdentity_whenTampered_thenDatabaseRejectsMutation` |

## 自动化门禁

```text
Java: 80 suites / 273 tests / 0 failure（+1 套件 +7 任务通知测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 286 schemas / 294 generated outputs / 256 operations
Database: V1-V92 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V92__clinical_task_notification.sql`：`clinical_task_notification`（任务/收件人/类型/渠道、`PENDING→DELIVERED/FAILED` 状态机、「DELIVERED 必含投递时间」「FAILED 必含失败原因」数据库约束、身份不可变触发器、任务索引）。
- 新增 `ClinicalTaskNotificationService`/`Controller`/`ExceptionHandler`：`POST /clinical-task-notifications`、`POST /clinical-task-notifications/{id}/deliveries`、`POST /clinical-task-notifications/{id}/failures`、`POST /clinical-task-notifications/recoveries`（恢复重投）、`GET /clinical-task-notifications`；契约新增 6 个 Schema 与 5 个端点（286 schemas / 294 outputs / 256 operations）。

## 未关闭风险

- O01 仅完成统一任务通知投递与恢复；科室级任务队列/团队视图、真实消息通道（SSE/推送）与定时投递调度未实现，O01 保持 `IN_PROGRESS`。
