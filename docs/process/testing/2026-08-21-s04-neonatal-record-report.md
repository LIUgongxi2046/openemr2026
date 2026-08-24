# S04 新生儿专科·新生儿记录首切测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（S01–S10 专科包整体仍 `IN_PROGRESS`）  
范围：FR-132 / S04 新生儿（record 层首切）

## 结论

新生儿专科包 record 层首切落地：`neonatal_record` 建立母婴关联（`mother_patient_id`，数据库约束 `mother_patient_id <> patient_id`）、出生时间、胎龄（22–45 周）、1/5 分钟 Apgar（0–10）、出生体重（200–7000 g）与出生性别；身份字段创建后不可篡改。母亲必须为女性患者、母亲不可为新生儿本人、胎龄/Apgar/体重越界均在服务端硬门拒绝。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。腕带/标本身份、筛查交接、复苏与随访六层未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| NR-001 | 创建并列表新生儿记录 | 母婴关联/胎龄/Apgar/体重/状态正确 | `NeonatalRecordApiTest.givenNeonate_…` |
| NR-002 | 自己作为母亲 | 拒绝 `NEONATAL_REQUEST_INVALID` | `givenSelfAsMother_…` |
| NR-003 | 母亲非女性（男性） | 拒绝 `NEONATAL_REQUEST_INVALID` | `givenMaleMother_…` |
| NR-004 | Apgar 越界（11） | 拒绝 `NEONATAL_REQUEST_INVALID` | `givenOutOfRangeApgar_…` |
| NR-005 | 记录身份不可变 | 胎龄 UPDATE 被触发器拒绝 | `givenRecordIdentity_whenTampered_…` |

## 自动化门禁

```text
Java: 49 suites / 148 tests / 0 failure（+1 套件 +5 新生儿测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 202 schemas / 210 generated outputs / 173 operations
Database: V1-V59 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V59__neonatal_record.sql`：`neonatal_record`（母婴关联 + `mother_patient_id <> patient_id` 硬约束、胎龄 22–45、Apgar 0–10、出生体重 200–7000、出生性别、身份不可变触发器、患者/母亲索引）。
- 新增 `NeonatalService`/`Controller`/`ExceptionHandler`：`POST /neonatal-records`、`GET /neonatal-records`；契约新增 2 个 Schema 与 2 个端点（202 schemas / 210 outputs / 173 operations）。

## 缺陷修复（本轮发现）

- C01 `EncounterStateMachineApiTest.givenPatientEncounterListing_whenQueried_thenReturnsCurrentHead` 因黄金患者 `018f0000-0000-7000-8000-000000000001` 在持久化开发库累积 431 条就诊，`listPatientEncounters` 的 `limit 100 + started_at desc` 把固定旧时间戳 `06:00:00Z` 的新就诊挤出前 100 而偶发失败。改为该用例自建随机患者并断言头元素，消除跨运行累积导致的脆弱性；其余状态机用例不受影响。

## 未关闭风险

- S04 仅完成 record 层；腕带/标本身份、筛查交接、复苏评估、喂养与随访等六层未实现，S01–S10 保持 `IN_PROGRESS`。
