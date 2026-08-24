# W01 转诊摘要首切测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（W01 整体仍 `IN_PROGRESS`）  
范围：FR-051/052 / W01 转诊摘要（院感暴发与真实上报渠道仍待办）

## 结论

W01 跨科协同域新增转诊摘要首切：`referral` 记录转诊类型（院内/院外）、转诊目标（院内科室或院外机构）、转诊原因与临床摘要，状态机 `DRAFT→SENT→ACCEPTED/REJECTED`。转诊硬门：

- 院内转诊必须指定目标科室、院外转诊必须指定目标机构（数据库 `check ((referral_type='INTERNAL')=(target_department is not null))` 与 EXTERNAL 对称约束）；
- 原因与临床摘要必填（摘要 ≥4 字符）；
- 状态机时间约束（已发送/已处理须有发送/处理时间，处理时间 ≥ 发送时间）。

身份字段（患者/就诊/类型/目标/原因/摘要）不可变，状态迁移走乐观锁。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。真实转诊渠道、院感暴发监测与 RCA 未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| RF-001 | 院内转诊发送并接受 | DRAFT→SENT→ACCEPTED | `ReferralApiTest.givenInternalReferral_…` |
| RF-002 | 院外转诊发送并拒绝 | DRAFT→SENT→REJECTED | `givenExternalReferral_…` |
| RF-003 | 院内转诊缺目标科室 | 拒绝 `REFERRAL_REQUEST_INVALID` | `givenInternalWithoutTargetDepartment_…` |
| RF-004 | 草稿直接接受 | 拒绝 `REFERRAL_STATE_INVALID` | `givenInvalidTransition_…` |
| RF-005 | 转诊身份不可变 | 原因 UPDATE 被触发器拒绝 | `givenReferralIdentity_whenTampered_…` |

## 自动化门禁

```text
Java: 63 suites / 207 tests / 0 failure（+1 套件 +5 转诊测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 236 schemas / 244 generated outputs / 207 operations
Database: V1-V75 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V75__referral.sql`：`referral`（转诊类型/目标、原因/摘要、「院内必有科室、院外必有机构」硬约束、`DRAFT→SENT→ACCEPTED/REJECTED` 状态机与状态/时间一致性约束、身份不可变触发器、患者索引）。
- 新增 `ReferralService`/`Controller`/`ExceptionHandler`：`POST /referrals`、`POST /referrals/{id}/transitions`（SEND/ACCEPT/REJECT）、`GET /referrals`；契约新增 3 个 Schema 与 3 个端点（236 schemas / 244 outputs / 207 operations）。

## 未关闭风险

- W01 仅完成转诊摘要；真实转诊渠道、院感暴发监测与 RCA 未实现，W01 保持 `IN_PROGRESS`。
