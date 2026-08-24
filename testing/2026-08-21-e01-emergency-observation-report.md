# E01 急诊留观首切测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（E01 整体仍 `IN_PROGRESS`）  
范围：FR-020/039 / E01 门急诊·急诊留观（抢救/护理与门急诊域间切换仍待办）

## 结论

E01 门急诊闭环新增急诊留观首切：`emergency_observation` 记录留观开始时间、去留处置（PENDING/DISCHARGED/ADMITTED/TRANSFERRED）与状态机 `OBSERVING→COMPLETED`。留观闭环硬门：完成留观必须给出明确处置（DISCHARGED/ADMITTED/TRANSFERRED），数据库约束 `(status='COMPLETED') = (disposition<>'PENDING')` + `(status='COMPLETED') = (completed_at is not null)`，杜绝「未决定去留即结束留观」。留观身份字段（患者/就诊/院区/开始时间）不可变；完成走乐观锁（`row_version` 冲突拒绝）。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。急诊抢救、护理、门急诊域间切换与真实留观时限策略未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| EO-001 | 开始留观并完成（DISCHARGED） | OBSERVING/PENDING → COMPLETED/DISCHARGED | `EmergencyObservationApiTest.givenObservation_…` |
| EO-002 | 过期行版本完成 | 拒绝 `EMERGENCY_OBSERVATION_VERSION_CONFLICT` | `givenStaleRowVersion_…` |
| EO-003 | 重复完成 | 拒绝 `EMERGENCY_OBSERVATION_STATE_INVALID` | `givenAlreadyCompleted_…` |
| EO-004 | 留观身份不可变 | 开始时间 UPDATE 被触发器拒绝 | `givenObservationIdentity_whenTampered_…` |

## 自动化门禁

```text
Java: 58 suites / 185 tests / 0 failure（+1 套件 +4 急诊留观测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 221 schemas / 229 generated outputs / 192 operations
Database: V1-V70 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V70__emergency_observation.sql`：`emergency_observation`（开始时间、去留处置、`OBSERVING→COMPLETED` 状态机、「完成须有处置」与「完成须有完成时间」数据库约束、身份不可变触发器、患者索引）。
- 新增 `EmergencyObservationService`/`Controller`/`ExceptionHandler`：`POST /emergency-observations`、`POST /emergency-observations/{id}/completions`、`GET /emergency-observations`；契约新增 3 个 Schema 与 3 个端点（221 schemas / 229 outputs / 192 operations）。

## 未关闭风险

- E01 仅完成急诊留观；急诊抢救/护理、门急诊域间切换与先救治后补登未实现，E01 保持 `IN_PROGRESS`。
