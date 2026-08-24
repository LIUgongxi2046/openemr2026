# E01 急诊护理首切测试报告

日期：2026-08-22  
状态：`LOCAL_VERIFIED`（E01 整体仍 `IN_PROGRESS`）  
范围：FR-020/039 / E01 门急诊·急诊护理（门急诊域间切换与先救治后补登仍待办）

## 结论

E01 门急诊闭环新增急诊护理首切：`emergency_nursing_note` 记录护理评估、护理措施、危重风险标记与记录时间。急诊护理安全硬门：危重风险标记的护理记录必须提供详细评估（`check (not risk_flag or length(trim(assessment)) >= 8)` + 服务端双保险），杜绝「标记危重却无详细评估」。身份与内容字段不可变。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。门急诊域间切换、先救治后补登与真实抢救团队记录未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| EN-001 | 创建并列表急诊护理记录 | 记录正确 | `EmergencyNursingNoteApiTest.givenNote_…` |
| EN-002 | 危重标记 + 详细评估 | 接受 | `givenRiskNoteWithDetailedAssessment_…` |
| EN-003 | 危重标记 + 简短评估 | 拒绝 `EMERGENCY_NURSING_NOTE_REQUEST_INVALID` | `givenRiskNoteWithShortAssessment_…` |
| EN-004 | 记录身份不可篡改 | assessment UPDATE 被触发器拒绝 | `givenNoteIdentity_whenTampered_…` |

## 自动化门禁

```text
Java: 77 suites / 257 tests / 0 failure（+1 套件 +4 急诊护理测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 275 schemas / 283 generated outputs / 246 operations
Database: V1-V89 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V89__emergency_nursing_note.sql`：`emergency_nursing_note`（评估/措施/危重标记/记录时间、「危重必详评估」硬约束、身份不可变触发器、患者索引）。
- 新增 `EmergencyNursingNoteService`/`Controller`/`ExceptionHandler`：`POST /emergency-nursing-notes`、`GET /emergency-nursing-notes`；契约新增 2 个 Schema 与 2 个端点（275 schemas / 283 outputs / 246 operations）。

## 未关闭风险

- E01 仅完成急诊护理；门急诊域间切换与先救治后补登未实现，E01 保持 `IN_PROGRESS`。
