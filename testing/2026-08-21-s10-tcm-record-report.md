# S10 中医专科·中医记录首切测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（S01–S10 专科包整体仍 `IN_PROGRESS`，record 层已全部首切）  
范围：FR-138 / S10 中医（record 层首切）

## 结论

中医专科包 record 层首切落地：`tcm_record` 记录证候（syndrome_pattern）、治法（treatment_principle）与方药（formula_name），并显式声明是否含毒性饮片（contains_toxic_herb）。毒性饮片安全硬门：含毒性饮片时毒性防护措施必填（服务端 + 数据库检查约束双保险）。证候/治法/方药必填且非空。身份/证候/治法/方药/毒性字段创建后不可篡改。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。四诊结构化、配伍禁忌、中西药相互作用与专科 AI eval 未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| TR-001 | 创建并列表中医记录 | 证候/治法/方药/毒性/状态正确 | `TcmRecordApiTest.givenPatient_…` |
| TR-002 | 含毒性饮片无防护措施 | 拒绝 `TCM_REQUEST_INVALID` | `givenToxicHerbWithoutPrecautions_…` |
| TR-003 | 含毒性饮片含防护措施 | 接受并回读措施 | `givenToxicHerbWithPrecautions_…` |
| TR-004 | 记录身份不可变 | 方药 UPDATE 被触发器拒绝 | `givenRecordIdentity_whenTampered_…` |

## 自动化门禁

```text
Java: 55 suites / 172 tests / 0 failure（+1 套件 +4 中医测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 214 schemas / 222 generated outputs / 185 operations
Database: V1-V65 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V65__tcm_record.sql`：`tcm_record`（证候/治法/方药必填非空、含毒性饮片声明与「含毒性饮片必填防护措施」硬约束、身份不可变触发器、患者索引）。
- 新增 `TcmService`/`Controller`/`ExceptionHandler`：`POST /tcm-records`、`GET /tcm-records`；契约新增 2 个 Schema 与 2 个端点（214 schemas / 222 outputs / 185 operations）。

## 里程碑

- S01–S10 十个核心专科能力包的 record 层首切已全部落地并各自通过全仓门禁（妇产/生殖/儿科/新生儿/精神心理/眼科/耳鼻喉/口腔/皮肤/中医）。各专科其余六层（workbench/evidence/treatment/care/followup/qc）与专科 AI eval 未实现，S01–S10 整体保持 `IN_PROGRESS`。

## 未关闭风险

- S10 仅完成 record 层；四诊结构化、配伍禁忌、中西药相互作用与随访六层未实现。
