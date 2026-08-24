# S06 眼科专科·眼科记录首切测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（S01–S10 专科包整体仍 `IN_PROGRESS`）  
范围：FR-134 / S06 眼科（record 层首切）

## 结论

眼科专科包 record 层首切落地：`ophthalmology_record` 记录侧别（OD/OS/OU）、双眼眼压（0–80 mmHg）、术眼标记（NONE/OD/OS/OU）与状态。术眼安全硬门：术眼为单眼时须与侧别一致（或记录覆盖双眼），避免术眼标记与记录侧别矛盾；眼压越界在服务端硬门拒绝，二者均由数据库检查约束双保险。身份/侧别/眼压/术眼字段创建后不可篡改。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。OCT/影像来源、知情同意、术前核对与专科 AI eval 未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| OR-001 | 创建并列表眼科记录 | 侧别/眼压/术眼/状态正确 | `OphthalmologyRecordApiTest.givenPatient_…` |
| OR-002 | 术眼与侧别矛盾（OD 记录标 OS 术眼） | 拒绝 `OPHTHALMOLOGY_REQUEST_INVALID` | `givenSurgicalEyeMismatch_…` |
| OR-003 | 眼压越界（85 mmHg） | 拒绝 `OPHTHALMOLOGY_REQUEST_INVALID` | `givenOutOfRangeIop_…` |
| OR-004 | 记录身份不可变 | 侧别 UPDATE 被触发器拒绝 | `givenRecordIdentity_whenTampered_…` |

## 自动化门禁

```text
Java: 51 suites / 156 tests / 0 failure（+1 套件 +4 眼科测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 206 schemas / 214 generated outputs / 177 operations
Database: V1-V61 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V61__ophthalmology_record.sql`：`ophthalmology_record`（侧别 OD/OS/OU、双眼眼压 0–80、术眼标记、「术眼须与侧别一致或覆盖双眼」硬约束、身份不可变触发器、患者索引）。
- 新增 `OphthalmologyService`/`Controller`/`ExceptionHandler`：`POST /ophthalmology-records`、`GET /ophthalmology-records`；契约新增 2 个 Schema 与 2 个端点（206 schemas / 214 outputs / 177 operations）。

## 未关闭风险

- S06 仅完成 record 层；OCT/影像来源与知情、术前核对、治疗与随访等六层未实现，S01–S10 保持 `IN_PROGRESS`。
