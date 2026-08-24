# S02 生殖 treatment 层·胚胎移植记录首切测试报告

日期：2026-08-22  
状态：`LOCAL_VERIFIED`（S01–S10 整体仍 `IN_PROGRESS`）  
范围：FR-130 / S02 生殖 treatment 层·胚胎移植（workbench/evidence/care/followup/qc 五层仍待办）

## 结论

S02 生殖专科 treatment 层新增胚胎移植记录首切：`art_embryo_transfer_record` 记录某 ART 周期的胚胎移植事件（胚胎数量、移植时间、操作者、核验者）。移植闭环硬门：双人核验（操作者与核验者分离，`operator_id <> verifier_id` + `SELF_VERIFICATION_FORBIDDEN`）；胚胎数量非负且至少 1（数据库约束 + 服务端）；移植前须已取得伦理同意（周期 `ethics_consent_date` 不晚于移植日期，否则 `ETHICS_CONSENT_REQUIRED`）；身份不可变。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。配子/胚胎追溯与库存对账未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| AET-001 | 已同意周期移植 | 落库，操作者/核验者落库 | `givenConsentedCycle_whenRecording_thenRecorded` |
| AET-002 | 移植早于伦理同意 | 拒绝 `ETHICS_CONSENT_REQUIRED` | `givenTransferBeforeConsent_whenRecording_thenRejected` |
| AET-003 | 核验者为本人 | 拒绝 `SELF_VERIFICATION_FORBIDDEN` | `givenSelfVerifier_whenRecording_thenRejected` |
| AET-004 | 零胚胎数 | 拒绝 `ART_EMBRYO_TRANSFER_REQUEST_INVALID` | `givenZeroEmbryoCount_whenRecording_thenRejected` |
| AET-005 | 移植记录篡改 | 不可变触发器拒绝 | `givenTransfer_whenTampered_thenDatabaseRejectsMutation` |

## 自动化门禁

```text
Java: 90 suites / 331 tests / 0 failure（+1 套件 +5 胚胎移植测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 308 schemas / 316 generated outputs / 278 operations
Database: V1-V102 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V102__art_embryo_transfer_record.sql`：`art_embryo_transfer_record`（周期/患者/胚胎数量/移植时间/操作者/核验者、「胚胎数量≥1」「操作者与核验者分离」显式命名约束、身份不可变触发器、患者索引）。
- 新增 `ArtEmbryoTransferService`/`Controller`/`ExceptionHandler`：`POST /art-embryo-transfer-records`（伦理同意 + 双人核验 + 胚胎数量硬门 + 幂等）、`GET /art-embryo-transfer-records`；契约新增 2 个 Schema 与 2 个端点（308 schemas / 316 outputs / 278 operations）。

## 未关闭风险

- S02 生殖仅完成 record 层与 treatment 层胚胎移植；workbench/evidence/care/followup/qc 五层、配子/胚胎追溯与库存对账未实现，S01–S10 保持 `IN_PROGRESS`。
