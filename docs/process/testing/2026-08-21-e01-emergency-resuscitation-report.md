# E01 急诊抢救首切测试报告

日期：2026-08-22  
状态：`LOCAL_VERIFIED`（E01 整体仍 `IN_PROGRESS`）  
范围：FR-020/039 / E01 门急诊·急诊抢救（急诊护理与门急诊域间切换仍待办）

## 结论

E01 门急诊闭环新增急诊抢救首切：`emergency_resuscitation` 记录抢救开始/结束时间与结局（PENDING/ROSC/DEATH/TRANSFERRED），状态机 `IN_PROGRESS→COMPLETED`。抢救闭环硬门：完成抢救必须给出明确结局（数据库约束 `(status='COMPLETED') = (outcome<>'PENDING')` + `= (ended_at is not null)`），杜绝「无结局即结束抢救」。身份字段（患者/就诊/院区/开始时间）不可变，完成走乐观锁。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。急诊护理、门急诊域间切换与真实抢救团队记录未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| ER-001 | 开始抢救并完成（ROSC） | IN_PROGRESS/PENDING→COMPLETED/ROSC | `EmergencyResuscitationApiTest.givenResuscitation_…` |
| ER-002 | 过期行版本完成 | 拒绝 `EMERGENCY_RESUSCITATION_VERSION_CONFLICT` | `givenStaleVersion_…` |
| ER-003 | 重复完成 | 拒绝 `EMERGENCY_RESUSCITATION_STATE_INVALID` | `givenCompletedResuscitation_…` |
| ER-004 | 抢救身份不可变 | 开始时间 UPDATE 被触发器拒绝 | `givenResuscitationIdentity_whenTampered_…` |

## 自动化门禁

```text
Java: 71 suites / 236 tests / 0 failure（+1 套件 +4 急诊抢救测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 260 schemas / 268 generated outputs / 231 operations
Database: V1-V83 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V83__emergency_resuscitation.sql`：`emergency_resuscitation`（开始/结束时间、结局、`IN_PROGRESS→COMPLETED` 状态机、「完成须有结局」与状态/时间一致性约束、身份不可变触发器、患者索引）。
- 新增 `EmergencyResuscitationService`/`Controller`/`ExceptionHandler`：`POST /emergency-resuscitations`、`POST /emergency-resuscitations/{id}/completions`、`GET /emergency-resuscitations`；契约新增 3 个 Schema 与 3 个端点（260 schemas / 268 outputs / 231 operations）。

## 未关闭风险

- E01 仅完成急诊抢救；急诊护理、门急诊域间切换与先救治后补登未实现，E01 保持 `IN_PROGRESS`。
