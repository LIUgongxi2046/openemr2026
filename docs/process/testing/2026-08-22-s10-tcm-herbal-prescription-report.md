# S10 中医 treatment 层·方药处方记录首切测试报告

日期：2026-08-22  
状态：`LOCAL_VERIFIED`（S01–S10 整体仍 `IN_PROGRESS`）  
范围：FR-138 / S10 中医 treatment 层·方药处方（workbench/evidence/care/followup/qc 五层仍待办）

## 结论

S10 中医专科 treatment 层新增方药处方记录首切：`tcm_herbal_prescription` 记录某就诊的中药方剂处方（方剂名、草药清单、含毒性饮片标记、毒性饮片防护措施、处方时间与处方者）。处方闭环硬门：含毒性饮片必须附防护措施（数据库约束 `not contains_toxic_herb or toxic_herb_precautions 非空` + 服务端 `TCM_TOXIC_HERB_PRECAUTIONS_REQUIRED`）；方剂名/草药清单非空；身份不可变。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。四诊结构化、配伍禁忌与中西药相互作用未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| THC-001 | 无毒饮片处方 | 落库并列表可见 | `givenPrescriptionWithoutToxicHerb_whenRecording_thenRecorded` |
| THC-002 | 毒性饮片附防护措施 | 接受 | `givenToxicHerbWithPrecautions_whenRecording_thenAccepted` |
| THC-003 | 毒性饮片缺防护措施 | 拒绝 `TCM_TOXIC_HERB_PRECAUTIONS_REQUIRED` | `givenToxicHerbWithoutPrecautions_whenRecording_thenRejected` |
| THC-004 | 处方篡改 | 不可变触发器拒绝 | `givenPrescription_whenTampered_thenDatabaseRejectsMutation` |

## 自动化门禁

```text
Java: 95 suites / 352 tests / 0 failure（+1 套件 +4 方药处方测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 318 schemas / 326 generated outputs / 288 operations
Database: V1-V107 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V107__tcm_herbal_prescription.sql`：`tcm_herbal_prescription`（患者/就诊/院区/方剂名/草药清单/含毒性饮片标记/毒性饮片防护措施/处方时间/处方者、「含毒性饮片必填防护措施」显式命名约束、身份不可变触发器、患者索引）。
- 新增 `TcmHerbalPrescriptionService`/`Controller`/`ExceptionHandler`：`POST /tcm-herbal-prescriptions`（毒性饮片防护措施硬门 + 活动就诊校验 + 幂等）、`GET /tcm-herbal-prescriptions`；契约新增 2 个 Schema 与 2 个端点（318 schemas / 326 outputs / 288 operations）。

## 未关闭风险

- S10 中医仅完成 record 层与 treatment 层方药处方；workbench/evidence/care/followup/qc 五层、四诊结构化、配伍禁忌与中西药相互作用未实现，S01–S10 保持 `IN_PROGRESS`。
