# S07 耳鼻喉专科·耳鼻喉记录首切测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（S01–S10 专科包整体仍 `IN_PROGRESS`）  
范围：FR-135 / S07 耳鼻喉（record 层首切）

## 结论

耳鼻喉专科包 record 层首切落地：`ent_record` 记录侧别（LEFT/RIGHT/BILATERAL）、分区（EAR/NOSE/THROAT）与气道风险等级（NONE/LOW/MODERATE/HIGH）。气道安全硬门：气道风险 HIGH 时气道防护措施必填（服务端 + 数据库检查约束双保险）。身份/侧别/分区/气道风险字段创建后不可篡改。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。听力/内镜、标本来源、术前气道评估与专科 AI eval 未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| ER-001 | 创建并列表耳鼻喉记录 | 侧别/分区/气道风险/状态正确 | `EntRecordApiTest.givenPatient_…` |
| ER-002 | 高气道风险无防护措施 | 拒绝 `ENT_REQUEST_INVALID` | `givenHighAirwayRiskWithoutPrecautions_…` |
| ER-003 | 高气道风险含防护措施 | 接受并回读措施 | `givenHighAirwayRiskWithPrecautions_…` |
| ER-004 | 记录身份不可变 | 分区 UPDATE 被触发器拒绝 | `givenRecordIdentity_whenTampered_…` |

## 自动化门禁

```text
Java: 52 suites / 160 tests / 0 failure（+1 套件 +4 耳鼻喉测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 208 schemas / 216 generated outputs / 179 operations
Database: V1-V62 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V62__ent_record.sql`：`ent_record`（侧别 LEFT/RIGHT/BILATERAL、分区 EAR/NOSE/THROAT、气道风险等级与「高气道风险必填防护措施」硬约束、身份不可变触发器、患者索引）。
- 新增 `EntService`/`Controller`/`ExceptionHandler`：`POST /ent-records`、`GET /ent-records`；契约新增 2 个 Schema 与 2 个端点（208 schemas / 216 outputs / 179 operations）。

## 未关闭风险

- S07 仅完成 record 层；听力/内镜、标本来源、治疗与随访等六层未实现，S01–S10 保持 `IN_PROGRESS`。
