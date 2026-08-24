# E01 接诊推进就诊（ARRIVED→IN_PROGRESS）测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（E01 整体仍 `IN_PROGRESS`）  
范围：FR-019/020 / E01 接诊首切（接诊推进就诊）

## 结论

预约报到后的「接诊」在同事务内把关联就诊从 `ARRIVED` 推进到 `IN_PROGRESS`（复用 `EncounterGateway.transitionEncounter` 与 V37 就诊状态机），并将候诊队列条目推进为 `IN_CONSULTATION`。预约→就诊→接诊形成连续闭环，就诊状态机、幂等、审计与 Outbox 保持一致。

这一结论只适用于本机合成数据。真实 HIS 分诊联动、先救治后补登与并发规模性能未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| CS-001 | 接诊推进 | 就诊 `ARRIVED→IN_PROGRESS`，队列 `WAITING/CALLED→IN_CONSULTATION` | `AppointmentSchedulingApiTest.givenCheckedInAppointment_whenConsulted_…` |
| CS-002 | 状态机一致性 | 复用 `EncounterGateway.transitionEncounter`，非法状态被拒绝 | 服务端注入网关 + 状态校验 |

## 自动化门禁

```text
Java: 33 suites / 96 tests / 0 failure（+1 接诊测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 154 schemas / 162 generated outputs / 117 operations
Database: V1-V42 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- `EncounterGateway` 增加 `transitionEncounter`，`ClinicalLifecycleService` 公开实现。
- `AppointmentService.consult`：校验 `CHECKED_IN` + 关联就诊 `ARRIVED` 后推进就诊到 `IN_PROGRESS`、队列到 `IN_CONSULTATION`；契约新增 `AppointmentConsultRequest` 与 `POST /appointments/{id}/consults`。

## 未关闭风险

- 接诊后尚未串联「书写门诊病历/诊断/医嘱/随访」业务动作，需后续在门诊工作台复用 R01/O01 内核。
- 急诊分级/抢救/护理/留观、先救治后补登与门急诊域间切换仍未实现，E01 保持 `IN_PROGRESS`。
