# E01 门急诊域间显式切换首切测试报告

日期：2026-08-22  
状态：`LOCAL_VERIFIED`（E01 整体仍 `IN_PROGRESS`）  
范围：FR-019/020/039/089/091/128 / E01 门急诊生产闭环·域间显式切换（真实临时身份分配仍待办）

## 结论

E01 门急诊闭环新增域间显式切换首切：`encounter_domain_switch` 记录患者照护在两个独立工作域（门诊/急诊）之间的显式迁移。切换闭环硬门：源域与目标域必须不同（数据库约束 `from_domain <> to_domain` + 服务端 `ENCOUNTER_DOMAIN_SWITCH_SAME_DOMAIN`）；源就诊与目标就诊必须不同（`from_encounter_id <> to_encounter_id` + `ENCOUNTER_DOMAIN_SWITCH_SAME_ENCOUNTER`）；两就诊必须同属同一患者（服务端校验，防跨患者串域）；原因必填；身份不可变。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。前端门诊/急诊工作域路由与真实临时身份分配未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| EDS-001 | 门诊→急诊显式切换 | 落库并列表可见 | `givenDifferentDomains_whenRecording_thenRecorded` |
| EDS-002 | 相同域切换 | 拒绝 `ENCOUNTER_DOMAIN_SWITCH_SAME_DOMAIN` | `givenSameDomain_whenRecording_thenRejected` |
| EDS-003 | 相同就诊切换 | 拒绝 `ENCOUNTER_DOMAIN_SWITCH_SAME_ENCOUNTER` | `givenSameEncounter_whenRecording_thenRejected` |
| EDS-004 | 跨患者就诊切换 | 拒绝 `CONTEXT_NOT_PERMITTED` | `givenEncounterOfAnotherPatient_whenRecording_thenRejected` |
| EDS-005 | 切换身份篡改 | 不可变触发器拒绝 | `givenSwitchIdentity_whenTampered_thenDatabaseRejectsMutation` |

## 自动化门禁

```text
Java: 84 suites / 297 tests / 0 failure（+1 套件 +5 域间切换测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 294 schemas / 302 generated outputs / 264 operations
Database: V1-V96 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V96__encounter_domain_switch.sql`：`encounter_domain_switch`（患者/源就诊/目标就诊/源域/目标域/原因/切换时间与人员、「源域≠目标域」「源就诊≠目标就诊」显式命名约束、身份不可变触发器、患者索引）。
- 新增 `EncounterDomainSwitchService`/`Controller`/`ExceptionHandler`：`POST /encounter-domain-switches`（域差异 + 就诊差异 + 两就诊同患者校验 + 幂等）、`GET /encounter-domain-switches`；契约新增 2 个 Schema 与 2 个端点（294 schemas / 302 outputs / 264 operations）。

## 未关闭风险

- E01 仅完成域间显式切换记录；前端门诊/急诊工作域路由、真实临时身份分配与危重升级未实现，E01 保持 `IN_PROGRESS`。
