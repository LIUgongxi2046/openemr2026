# S01 妇产专科·产科记录首切测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（S01–S10 专科包整体仍 `IN_PROGRESS`）  
范围：FR-129 / S01 妇产（record 层首切）

## 结论

妇产专科包 record 层首切落地：`obstetric_record` 记录孕次/产次（产次 ≤ 孕次）、孕周（0–45 周）、预产期、血型/Rh、高危因素；身份字段创建后不可篡改；预产期必须晚于当前日期。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。产程图、母婴身份关联、子痫/产后出血硬门与专科 AI eval 未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| OB-001 | 创建并列表产科记录 | 孕周/血型/高危正确 | `ObstetricRecordApiTest.givenObstetricPatient_…` |
| OB-002 | 产次 > 孕次 | 拒绝 | `givenParityExceedingGravidity_…` |
| OB-003 | 身份字段不可变 | 孕周 UPDATE 被触发器拒绝 | `givenObstetricRecordIdentity_whenTampered_…` |

## 自动化门禁

```text
Java: 45 suites / 133 tests / 0 failure（+1 套件 +3 产科记录测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 192 schemas / 200 generated outputs / 117 operations
Database: V1-V55 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V55__obstetric_record.sql`：`obstetric_record`（孕次/产次/孕周/预产期/血型/Rh/高危、身份不可变触发器、患者索引）。
- 新增 `ObstetricService`/`Controller`/`ExceptionHandler`：`POST /obstetric-records`、`GET /obstetric-records`；契约新增 2 个 Schema。

## 未关闭风险

- S01 仅完成 record 层；workbench/evidence/treatment/care/followup/qc 六层、产程/母婴身份/子痫/产后出血硬门、专科 AI eval 与发行 manifest 仍未实现，S01–S10 保持 `IN_PROGRESS`。
