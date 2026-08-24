# N01 转区任务迁移首切测试报告

日期：2026-08-22  
状态：`LOCAL_VERIFIED`（N01 整体仍 `IN_PROGRESS`）  
范围：FR-022/096 / N01 护理·转区任务迁移（移动端断网队列仍待办）

## 结论

N01 护理病区新增转区任务迁移首切：为 `clinical_task` 增加可选 `ward_id`（外键至 `clinical_ward`），并提供 `POST /clinical-tasks/ward-migrations` 将某就诊的未闭环任务从源病区迁移到目标病区。迁移闭环硬门：源病区与目标病区必须不同（`WARD_TRANSFER_SAME_WARD`）；两病区必须存在（外键 + 服务端校验）；仅非终态任务（`PENDING/ASSIGNED/DELIVERED/VIEWED/CLAIMED/IN_PROGRESS/ESCALATED`）且 `ward_id` 为空或等于源病区的任务被迁移（终态任务不受影响）；迁移幂等（再次迁移返回 0）。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。真实床旁离线队列与停药/在途执行竞态未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| WTM-001 | 未闭环任务迁移 | 迁移 2 条，ward_id 指向目标病区，终态任务不变 | `givenOpenTasks_whenMigrating_thenReassignedToTargetWard` |
| WTM-002 | 同病区迁移 | 拒绝 `WARD_TRANSFER_SAME_WARD` | `givenSameWard_whenMigrating_thenRejected` |
| WTM-003 | 重复迁移幂等 | migrated_count=0 | `givenAlreadyMigrated_whenMigratingAgain_thenZero` |

## 自动化门禁

```text
Java: 96 suites / 355 tests / 0 failure（+1 套件 +3 转区任务迁移测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 320 schemas / 328 generated outputs / 289 operations
Database: V1-V108 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V108__clinical_task_ward.sql`：为 `clinical_task` 增加可选 `ward_id` 列 + 外键至 `clinical_ward` + 部分索引。
- 新增 `WardTransferTaskMigrationService`/`Controller`/`ExceptionHandler`：`POST /clinical-tasks/ward-migrations`（源/目标病区不同 + 两病区存在 + 仅非终态任务迁移 + 幂等）；契约新增 2 个 Schema 与 1 个端点（320 schemas / 328 outputs / 289 operations）。

## 未关闭风险

- N01 仅完成转区任务迁移；移动端断网队列、真实停药/在途执行竞态与跨病区交接未完项联动未实现，N01 保持 `IN_PROGRESS`。
