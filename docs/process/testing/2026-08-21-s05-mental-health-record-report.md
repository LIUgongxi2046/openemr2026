# S05 精神心理专科·精神心理记录首切测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（S01–S10 专科包整体仍 `IN_PROGRESS`）  
范围：FR-133 / S05 精神心理（record 层首切）

## 结论

精神心理专科包 record 层首切落地：`mental_health_record` 强制 `data_classification = 'RESTRICTED'`（数据库检查约束，精神心理数据不可降级为更低密级），记录自杀风险（NONE/LOW/MODERATE/HIGH/IMMINENT）与暴力风险（NONE/LOW/MODERATE/HIGH）等级与评估时间；当自杀风险为 HIGH/IMMINENT 或暴力风险为 HIGH 时，保护措施必填（服务端硬门 + 数据库检查约束双保险）。身份与风险字段创建后不可篡改。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。危机交接、保护性约束、限制数据访问策略与专科 AI eval 未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| MR-001 | 创建并列表精神心理记录 | 密级 RESTRICTED/风险/状态正确 | `MentalHealthRecordApiTest.givenPatient_…` |
| MR-002 | 高风险无保护措施 | 拒绝 `MENTAL_HEALTH_REQUEST_INVALID` | `givenHighRiskWithoutMeasures_…` |
| MR-003 | 高风险含保护措施 | 接受并回读措施 | `givenHighRiskWithMeasures_…` |
| MR-004 | 记录身份不可变 | 自杀风险 UPDATE 被触发器拒绝 | `givenRecordIdentity_whenTampered_…` |

## 自动化门禁

```text
Java: 50 suites / 152 tests / 0 failure（+1 套件 +4 精神心理测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 204 schemas / 212 generated outputs / 175 operations
Database: V1-V60 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V60__mental_health_record.sql`：`mental_health_record`（强制 RESTRICTED 密级、自杀/暴力风险等级、评估时间、保护措施与「高风险必填保护措施」硬约束、身份不可变触发器、患者索引）。
- 新增 `MentalHealthService`/`Controller`/`ExceptionHandler`：`POST /mental-health-records`、`GET /mental-health-records`；契约新增 2 个 Schema 与 2 个端点（204 schemas / 212 outputs / 175 operations）。

## 未关闭风险

- S05 仅完成 record 层；危机交接、保护性约束/隔离、限制数据访问控制、治疗与随访等六层未实现，S01–S10 保持 `IN_PROGRESS`。
