# S09 皮肤 treatment 层·生物制剂筛查记录首切测试报告

日期：2026-08-22  
状态：`LOCAL_VERIFIED`（S01–S10 整体仍 `IN_PROGRESS`）  
范围：FR-137 / S09 皮肤 treatment 层·生物制剂筛查（workbench/evidence/care/followup/qc 五层仍待办）

## 结论

S09 皮肤专科 treatment 层新增生物制剂筛查记录首切：`dermatology_biologic_screening` 记录启用生物制剂前的结核/肝炎筛查结果与放行结论。筛查闭环硬门：启用生物制剂必须结核与肝炎筛查均阴性（数据库约束 `cleared_for_biologic = (tb=NEGATIVE and hepatitis=NEGATIVE)`，结论由服务端按筛查结果计算、不由调用方指定）；筛查结果合法枚举；身份不可变。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。真实皮损图谱与影像授权未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| DBS-001 | 双阴性筛查 | cleared=true 落库 | `givenNegativeScreenings_whenRecording_thenCleared` |
| DBS-002 | 结核阳性 | cleared=false | `givenPositiveTb_whenRecording_thenNotCleared` |
| DBS-003 | 绕过服务放行阳性 | 数据库约束拒绝 | `givenClearedWithPositiveTbBypass_whenInserting_thenDatabaseRejects` |
| DBS-004 | 筛查篡改 | 不可变触发器拒绝 | `givenScreening_whenTampered_thenDatabaseRejectsMutation` |

## 自动化门禁

```text
Java: 94 suites / 348 tests / 0 failure（+1 套件 +4 生物制剂筛查测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 316 schemas / 324 generated outputs / 286 operations
Database: V1-V106 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V106__dermatology_biologic_screening.sql`：`dermatology_biologic_screening`（患者/就诊/院区/生物制剂名称/结核与肝炎筛查结果/放行结论/时间/筛查者、「放行须双阴性」显式命名约束、身份不可变触发器、患者索引）。
- 新增 `DermatologyBiologicScreeningService`/`Controller`/`ExceptionHandler`：`POST /dermatology-biologic-screenings`（放行结论服务端计算 + 活动就诊校验 + 幂等）、`GET /dermatology-biologic-screenings`；契约新增 2 个 Schema 与 2 个端点（316 schemas / 324 outputs / 286 operations）。

## 未关闭风险

- S09 皮肤仅完成 record 层与 treatment 层生物制剂筛查；workbench/evidence/care/followup/qc 五层、真实皮损图谱与影像授权未实现，S01–S10 保持 `IN_PROGRESS`。
