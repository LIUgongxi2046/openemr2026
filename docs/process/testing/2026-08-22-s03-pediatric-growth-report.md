# S03 儿科 care 层·生长发育记录首切测试报告

日期：2026-08-22  
状态：`LOCAL_VERIFIED`（S01–S10 整体仍 `IN_PROGRESS`）  
范围：FR-131 / S03 儿科 care 层·生长发育记录（workbench/evidence/treatment/followup/qc 五层仍待办）

## 结论

S03 儿科专科 care 层新增生长发育记录首切：`pediatric_growth_record` 记录患儿身高/体重/头围的连续测量。生长闭环硬门：身高 30–220cm、体重 0.5–250kg、头围 20–70cm 的生理范围约束（数据库显式命名约束 + 服务端 `PEDIATRIC_GROWTH_REQUEST_INVALID`）；测量时间必填；身份不可变。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。生长曲线百分位与危重升级未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| PG-001 | 记录生长发育 | 身高/体重/头围落库 | `givenGrowth_whenRecording_thenRecorded` |
| PG-002 | 身高越界 | 拒绝 `PEDIATRIC_GROWTH_REQUEST_INVALID` | `givenOutOfRangeHeight_whenRecording_thenRejected` |
| PG-003 | 体重越界 | 拒绝 `PEDIATRIC_GROWTH_REQUEST_INVALID` | `givenOutOfRangeWeight_whenRecording_thenRejected` |
| PG-004 | 头围越界 | 拒绝 `PEDIATRIC_GROWTH_REQUEST_INVALID` | `givenOutOfRangeHead_whenRecording_thenRejected` |
| PG-005 | 记录篡改 | 不可变触发器拒绝 | `givenGrowth_whenTampered_thenDatabaseRejectsMutation` |

## 自动化门禁

```text
Java: 91 suites / 336 tests / 0 failure（+1 套件 +5 生长发育测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 310 schemas / 318 generated outputs / 280 operations
Database: V1-V103 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V103__pediatric_growth_record.sql`：`pediatric_growth_record`（患者/就诊/院区/身高/体重/头围/测量时间/记录者、「身高 30–220」「体重 0.5–250」「头围 20–70」显式命名约束、身份不可变触发器、患者索引）。
- 新增 `PediatricGrowthService`/`Controller`/`ExceptionHandler`：`POST /pediatric-growth-records`（生理范围硬门 + 活动就诊校验 + 幂等）、`GET /pediatric-growth-records`；契约新增 2 个 Schema 与 2 个端点（310 schemas / 318 outputs / 280 operations）。

## 未关闭风险

- S03 儿科仅完成 record 层与 care 层生长发育；workbench/evidence/treatment/followup/qc 五层、生长曲线百分位与危重升级未实现，S01–S10 保持 `IN_PROGRESS`。
