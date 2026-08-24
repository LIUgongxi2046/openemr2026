# E01 门急诊预约/挂号号源首切测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（E01 整体仍 `IN_PROGRESS`）  
范围：FR-019/020 / E01 班次号源·预约·挂号·退号

## 结论

门急诊预约挂号首切落地：建立班次号源（`schedule_slot`）、预约挂号（`appointment`）与不可变预约事件（`appointment_event`）。预约通过原子 `booked_count` 递增 + `booked_count < total_capacity` 守卫实现「号源不超卖」；退号原子释放号源并留证；同一幂等键重放不会重复占号。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。真实 HIS 号源同步、多机构号源池、候诊/叫号与并发规模性能未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| AP-001 | 单号源两次预约 | 第二次 `SCHEDULE_SLOT_UNAVAILABLE`，`booked_count` 不超卖 | `AppointmentSchedulingApiTest.givenSingleCapacitySlot_…` |
| AP-002 | 退号释放号源 | `CANCELLED` + `booked_count` 归零 + 可再次预约 | `givenBookedAppointment_whenCancelled_…` |
| AP-003 | 幂等重放 | `IDEMPOTENCY_REPLAY`，不重复占号 | `givenReplayedBookingKey_…` |
| AP-004 | 预约事件不可变 | UPDATE/DELETE 被触发器拒绝 | `givenAppointmentEvents_whenTampered_…` |

## 自动化门禁

```text
Java: 33 suites / 93 tests / 0 failure（+1 套件 +4 预约测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 150 schemas / 158 generated outputs / 117 operations
Database: V1-V40 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V40__appointment_scheduling_core.sql`：`schedule_slot`（班次号源，容量+已预约原子计数）、`appointment`（预约，状态机 BOOKED→CANCELLED/CHECKED_IN/NO_SHOW/COMPLETED）、`appointment_event`（不可变事件）与号源窗口唯一索引。
- 新增 `AppointmentService`/`AppointmentController`/`AppointmentExceptionHandler`：`POST /schedule-slots`、`POST /appointments`、`POST /appointments/{id}/cancellations`、`GET /appointments`；契约新增 5 个 Schema（`ScheduleSlot`、`ScheduleSlotCreateRequest`、`Appointment`、`AppointmentBookRequest`、`AppointmentCancelRequest`）。

## 未关闭风险

- 号源目前由单机构内创建，未接真实班次/排班与多机构号源池。
- 候诊/叫号、接诊、门诊病历/诊断/医嘱/随访、急诊分级/抢救/护理/留观/交接与门急诊域间切换仍未实现，E01 保持 `IN_PROGRESS`。
- 预约仅在单租户合成规模验证，未做高并发号源抢订的 p95 性能与死锁验收。
