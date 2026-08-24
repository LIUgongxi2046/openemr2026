# E01 急诊分级首切测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（E01 整体仍 `IN_PROGRESS`）  
范围：FR-019/020/039 / E01 门急诊·急诊分级（抢救/护理/留观与门急诊域间切换仍待办）

## 结论

E01 门急诊闭环新增急诊分级首切：`emergency_triage_assessment` 记录四级分诊（`LEVEL_1` 濒危立即复苏 / `LEVEL_2` 危重 / `LEVEL_3` 急症 / `LEVEL_4` 非急症）、主诉、分诊时间与立即处置标记。急诊安全硬门：`LEVEL_1` 必须显式 `immediate_action_required = true`（服务端 + 数据库检查约束双保险），杜绝濒危患者被分诊为最高级却未触发立即处置。身份/分级/主诉/分诊时间/立即处置字段创建后不可篡改。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。急诊抢救、护理、留观、门急诊域间切换与真实分诊量表未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| ET-001 | 创建并列表急诊分级 | 分级/主诉/立即处置/状态正确 | `EmergencyTriageApiTest.givenPatient_…` |
| ET-002 | LEVEL_1 未标立即处置 | 拒绝 `EMERGENCY_TRIAGE_REQUEST_INVALID` | `givenLevel1WithoutImmediateAction_…` |
| ET-003 | LEVEL_1 标立即处置 | 接受并回读 | `givenLevel1WithImmediateAction_…` |
| ET-004 | 分级身份不可变 | 分级 UPDATE 被触发器拒绝 | `givenAssessmentIdentity_whenTampered_…` |

## 自动化门禁

```text
Java: 56 suites / 178 tests / 0 failure（+1 套件 +4 急诊分级测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 216 schemas / 224 generated outputs / 187 operations
Database: V1-V68 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V68__emergency_triage.sql`：`emergency_triage_assessment`（四级分诊、主诉、分诊时间、立即处置标记、「LEVEL_1 必标立即处置」硬约束、身份不可变触发器、患者索引）。
- 新增 `EmergencyTriageService`/`Controller`/`ExceptionHandler`：`POST /emergency-triage-assessments`、`GET /emergency-triage-assessments`；契约新增 2 个 Schema 与 2 个端点（216 schemas / 224 outputs / 187 operations）。

## 未关闭风险

- E01 仅完成急诊分级；急诊抢救/护理/留观、门急诊域间切换与先救治后补登未实现，E01 保持 `IN_PROGRESS`。
