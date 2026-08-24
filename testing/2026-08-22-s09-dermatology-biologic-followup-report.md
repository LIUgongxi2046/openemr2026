# S09 皮肤 followup 层·生物制剂随访记录首切测试报告

日期：2026-08-22  
状态：`LOCAL_VERIFIED`（S01–S10 整体仍 `IN_PROGRESS`）  
范围：FR-137 / S09 皮肤 followup 层·生物制剂随访（workbench/evidence/qc 三层仍待办）

## 结论

S09 皮肤专科 followup 层新增生物制剂随访记录首切：`dermatology_biologic_followup` 记录生物制剂治疗后的随访（PASI 复查评分、不良事件）。随访闭环硬门：发生不良事件必须附描述（数据库约束 `not adverse_event or adverse_event_description 非空` + 服务端 `DERMATOLOGY_BIOLOGIC_ADVERSE_EVENT_DESCRIPTION_REQUIRED`）；PASI 评分 0–72；身份不可变。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。真实皮损图谱与影像授权未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| DBF-001 | 生物制剂随访 | PASI 落库并列表可见 | `givenFollowup_whenRecording_thenRecorded` |
| DBF-002 | 不良事件附描述 | 接受 | `givenAdverseEventWithDescription_whenRecording_thenAccepted` |
| DBF-003 | 不良事件缺描述 | 拒绝 `DERMATOLOGY_BIOLOGIC_ADVERSE_EVENT_DESCRIPTION_REQUIRED` | `givenAdverseEventWithoutDescription_whenRecording_thenRejected` |
| DBF-004 | PASI 越界 | 拒绝 `DERMATOLOGY_BIOLOGIC_FOLLOWUP_REQUEST_INVALID` | `givenOutOfRangePasi_whenRecording_thenRejected` |
| DBF-005 | 随访篡改 | 不可变触发器拒绝 | `givenFollowup_whenTampered_thenDatabaseRejectsMutation` |

## 自动化门禁

```text
Java: 106 suites / 400 tests / 0 failure（+1 套件 +5 生物制剂随访测试）★ 400 测试里程碑
Web: 5 files / 17 tests / 0 failure
Contracts: 343 schemas / 351 generated outputs / 312 operations
Database: V1-V118 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V118__dermatology_biologic_followup.sql`：`dermatology_biologic_followup`（患者/就诊/院区/生物制剂名称/随访日期/PASI 评分/不良事件标记/不良事件描述/记录者/记录时间、「PASI 0–72」「不良事件必填描述」显式命名约束、身份不可变触发器、患者索引）。
- 新增 `DermatologyBiologicFollowupService`/`Controller`/`ExceptionHandler`：`POST /dermatology-biologic-followups`（不良事件描述硬门 + 活动就诊校验 + 幂等）、`GET /dermatology-biologic-followups`；契约新增 2 个 Schema 与 2 个端点（343 schemas / 351 outputs / 312 operations）。

## 未关闭风险

- S09 皮肤仅完成 record/treatment/followup 三层；workbench/evidence/qc 三层、真实皮损图谱与影像授权未实现，S01–S10 保持 `IN_PROGRESS`。
