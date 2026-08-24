# E01 门急诊候诊/叫号测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（E01 整体仍 `IN_PROGRESS`）  
范围：FR-019/020 / E01 候诊·叫号

## 结论

预约号源在「报到（check-in）」后进入按机构/日期排序的候诊队列（`waiting_queue_entry`），报到通过机构行锁串行分配递增序号，`BOOKED → CHECKED_IN` 与队列入队同事务；叫号将 `WAITING → CALLED` 并记录叫号人与时间；重复报到被状态机拒绝。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。真实叫号终端、语音/屏显通知与并发规模性能未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| WQ-001 | 报到入队 | 预约 `CHECKED_IN`，队列 `WAITING` 且序号递增 | `AppointmentSchedulingApiTest.givenBookedAppointment_whenCheckedInAndCalled_…` |
| WQ-002 | 叫号 | 队列 `CALLED` 且记录 `called_at/called_by` | 同一测试 |
| WQ-003 | 重复报到 | `APPOINTMENT_STATE_INVALID` | `givenCheckedInAppointment_whenCheckedInAgain_…` |
| WQ-004 | 队列列表 | 按机构/日期返回 | `listWaitingQueue` 断言 |

## 自动化门禁

```text
Java: 33 suites / 95 tests / 0 failure（+2 候诊叫号测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 153 schemas / 161 generated outputs / 117 operations
Database: V1-V41 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V41__waiting_queue.sql`：`appointment.check_in_at` 与 `waiting_queue_entry`（机构/日期唯一序号、状态机 `WAITING→CALLED→…`、叫号人与时间）。
- `AppointmentService` 增加 `checkIn`/`callWaitingQueue`/`listWaitingQueue`；契约新增 3 个 Schema（`WaitingQueueEntry`、`AppointmentCheckInRequest`、`WaitingQueueCallRequest`）与 3 个端点（`POST /appointments/{id}/check-ins`、`POST /waiting-queue/{id}/calls`、`GET /waiting-queue`）。

## 未关闭风险

- 报到尚未生成门诊就诊（`encounter`）——预约→就诊的临床闭环需在后续接诊步骤通过跨模块网关建立。
- 接诊、门诊病历/诊断/医嘱/随访、急诊分级/抢救/护理/留观与门急诊域间切换仍未实现，E01 保持 `IN_PROGRESS`。
- 叫号仅命令驱动，未接真实叫号终端、语音/屏显通知与到达超时处理。
