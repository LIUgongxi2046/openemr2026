# O01 定时投递调度（V125）证据报告

> 日期：2026-08-22
> 切片：`ClinicalTaskNotification.dispatchDue`（`clinical_task_notification.scheduled_at`）
> 范围：O01 统一任务·定时投递调度首切
> 结论：**VERIFIED**（本机全量门禁通过）

## 1. 结论

在既有 `clinical_task_notification`（V92）之上，新增定时投递调度：通知新增 `scheduled_at` 调度时间（缺省立即投递），`dispatchDue(scheduled_before, batch_size)` 以 `FOR UPDATE SKIP LOCKED` 抢占式领取 `scheduled_at ≤ 截止时间` 的 PENDING 通知并批量投递（乐观推进 `PENDING→DELIVERED` + 投递时间 + attempt_count 递增），返回本批投递数量与通知 id 列表。硬门：只投递 PENDING、只投递已到期（`scheduled_at ≤ scheduled_before`）、批量上限 1–1000、幂等与审计哈希链/Outbox 全程记录。

## 2. 高风险验收表

| 验收项 | 硬门/约束 | 证据 |
|---|---|---|
| 只投递已到期 PENDING | `status='PENDING' and scheduled_at <= :before` | `givenDuePendingNotification_whenDispatching_thenDelivered` |
| 未到期不投递 | `scheduled_at > :before` 不命中 | `givenFutureScheduledNotification_whenDispatching_thenNotDelivered` |
| 批量上限 | `batch_size` 1–1000 校验 | 服务层校验 |
| 并发抢占 | `FOR UPDATE SKIP LOCKED` + 状态/时间推进 | 服务层实现 |
| 调度列非空 | V125 `scheduled_at not null default now()` | assert-v125 |

## 3. 自动化门禁

```
scripts/verify.sh → VERIFY_EXIT=0
- contracts test/check：3/3，check 无漂移（362 schemas / 370 outputs / 335 operations）
- AI eval：100/100
- red-team：15 payloads / 12 surfaces
- test-schema.sh：V1–V125 迁移 + 断言，rollback 通过
- backup-restore-verify.sh：通过
- gradle test：112 suites / 438 tests / 0 failures
- web test + build：通过
- security-scan.sh：通过
- verify-traceability.mjs：138/138 FR / 138/138 AC / 138/138 route refs
- generate-route-map.mjs --audit：194/194 routes
```

## 4. 本批实现

- **迁移 V125**：`clinical_task_notification` 增加 `scheduled_at timestamptz not null default now()` + `clinical_task_notification_dispatch_idx` 调度索引。
- **契约**：`ClinicalTaskNotification`/`CreateRequest` 增 `scheduled_at`；新增 `ClinicalTaskNotificationDispatchRequest`、`ClinicalTaskNotificationDispatchResult` 两 Schema 与 `POST /clinical-task-notifications/dispatches` 端点。
- **模块**：`ClinicalTaskNotificationService` 增加 `dispatchDue`（批量投递 + 幂等 + 逐通知审计/Outbox）并让 `create` 支持可选 `scheduled_at`；`Controller` 增加 dispatch 端点。
- **测试**：`ClinicalTaskNotificationApiTest` 新增 2 用例（到期投递、未到期不投递），并适配 CreateRequest 新增字段。

## 5. 未关闭风险

- 真实消息通道（SSE/推送）仍未实现（O01 其余项，属真实适配器）。
- 定时调度为服务方法，未接 Spring `@Scheduled` 的常驻 cron 触发器（部署侧定时任务调用 `dispatchDue` 即可）。
- 按当前优先级，O01 代码层已基本收口；后续继续 A01 审批流/SSE、Q01 源系统盘点、D01 成员计算引擎、A02 限频/转任务等全局史诗。
