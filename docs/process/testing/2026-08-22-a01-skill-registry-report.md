# A01 Skill 目录首切测试报告

日期：2026-08-22  
状态：`LOCAL_VERIFIED`（A01 整体仍 `IN_PROGRESS`）  
范围：FR-030–037/070–081 / A01 AI 平台·Skill 目录（Tool 目录、预算/fencing/审批与 SSE 恢复仍待办）

## 结论

A01 AI 平台新增 Skill 目录首切：`skill_registry` 记录技能编码、名称、版本与状态 `ACTIVE/INACTIVE`。目录治理硬门：技能编码唯一且不可变（数据库唯一约束 + 触发器保护 skill_code/skill_name/skill_version）。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。Tool 目录、Agent/Skill 依赖解析、预算/fencing/审批与 SSE 恢复未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| SK-001 | 登记并列表技能 | ACTIVE 技能正确 | `SkillRegistryApiTest.givenSkill_…` |
| SK-002 | 停用活动技能 | ACTIVE→INACTIVE | `givenActiveSkill_whenDeactivating_…` |
| SK-003 | 技能身份不可变 | skill_code UPDATE 被触发器拒绝 | `givenSkillIdentity_whenTampered_…` |

## 自动化门禁

```text
Java: 72 suites / 239 tests / 0 failure（+1 套件 +3 Skill 目录测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 263 schemas / 271 generated outputs / 234 operations
Database: V1-V84 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V84__skill_registry.sql`：`skill_registry`（技能编码/名称/版本、`ACTIVE/INACTIVE`、编码唯一 + 身份不可变触发器、状态索引）。
- 新增 `SkillRegistryService`/`Controller`/`ExceptionHandler`：`POST /skill-registry`、`POST /skill-registry/{id}/deactivations`、`GET /skill-registry`（可按状态过滤）；契约新增 3 个 Schema 与 3 个端点（263 schemas / 271 outputs / 234 operations）。

## 未关闭风险

- A01 仅完成 Skill 目录；Tool 目录、Agent/Skill 依赖解析、预算/fencing/审批与 SSE 恢复未实现，A01 保持 `IN_PROGRESS`。
