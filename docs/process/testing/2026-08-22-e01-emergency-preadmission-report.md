# E01 先救治后补登首切测试报告

日期：2026-08-22  
状态：`LOCAL_VERIFIED`（E01 整体仍 `IN_PROGRESS`）  
范围：FR-020/039 / E01 门急诊·先救治后补登（门急诊域间切换仍待办）

## 结论

E01 门急诊闭环新增先救治后补登首切：`emergency_preadmission` 记录未登记危重患者的临时身份标识与先救治原因，状态机 `UNREGISTERED→REGISTERED`。补登闭环硬门：补登必须关联已登记患者并记录补登时间（数据库约束 `(status='REGISTERED') = (registered_patient_id is not null)` + `= (registered_at is not null)`）；临时身份标识唯一且不可变。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。门急诊域间切换与真实临时身份分配未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| EP-001 | 先救治登记并补登关联患者 | UNREGISTERED→REGISTERED | `EmergencyPreadmissionApiTest.givenPreadmission_…` |
| EP-002 | 过期行版本补登 | 拒绝 `EMERGENCY_PREADMISSION_VERSION_CONFLICT` | `givenStaleVersion_…` |
| EP-003 | 已补登重复补登 | 拒绝 `EMERGENCY_PREADMISSION_STATE_INVALID` | `givenAlreadyRegistered_…` |
| EP-004 | 临时身份不可篡改 | temporary_identifier UPDATE 被触发器拒绝 | `givenPreadmissionIdentity_whenTampered_…` |

## 自动化门禁

```text
Java: 78 suites / 261 tests / 0 failure（+1 套件 +4 先救治后补登测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 278 schemas / 286 generated outputs / 249 operations
Database: V1-V90 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V90__emergency_preadmission.sql`：`emergency_preadmission`（临时身份/原因、`UNREGISTERED→REGISTERED` 状态机、「补登须关联患者与补登时间」数据库约束、临时身份唯一 + 不可变触发器、院区索引）。
- 新增 `EmergencyPreadmissionService`/`Controller`/`ExceptionHandler`：`POST /emergency-preadmissions`、`POST /emergency-preadmissions/{id}/links`、`GET /emergency-preadmissions`；契约新增 3 个 Schema 与 3 个端点（278 schemas / 286 outputs / 249 operations）。

## 未关闭风险

- E01 仅完成先救治后补登；门急诊域间切换与真实临时身份分配未实现，E01 保持 `IN_PROGRESS`。
