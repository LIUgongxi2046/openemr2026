# A01 Prompt Release 首切测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（A01 整体仍 `IN_PROGRESS`）  
范围：FR-030–037/056/070–081 / A01 AI 平台·Prompt release（Agent/Skill/Tool 目录与预算/fencing/审批仍待办）

## 结论

A01 AI 平台新增 Prompt release 首切：`prompt_release` 记录提示词编码、发布版本、显示名与不可变内容，状态 `DRAFT/ACTIVE/RETIRED`。发布治理硬门：同一 `prompt_code` 仅允许一个 `ACTIVE` 版本（部分唯一索引），发布新版本同事务退休旧 `ACTIVE`；内容与身份字段（content/prompt_code/release_version/published_by/effective_from）发布后不可篡改（数据库触发器）。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。真实模型评估、Agent/Skill/Tool 目录、预算/fencing/审批与 SSE 恢复未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| PR-001 | 发布并列表提示词版本 | ACTIVE 版本正确 | `PromptReleaseApiTest.givenPrompt_…` |
| PR-002 | 发布新版本退休旧版本 | 旧 RETIRED、新 ACTIVE、仅 1 个 ACTIVE | `givenNewVersion_whenPublishing_…` |
| PR-003 | 退休活动版本 | ACTIVE→RETIRED | `givenActiveRelease_whenRetiring_…` |
| PR-004 | 内容不可篡改 | content UPDATE 被触发器拒绝 | `givenReleaseContent_whenTampered_…` |

## 自动化门禁

```text
Java: 64 suites / 211 tests / 0 failure（+1 套件 +4 Prompt release 测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 239 schemas / 247 generated outputs / 210 operations
Database: V1-V76 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V76__prompt_release.sql`：`prompt_release`（提示词编码/版本/显示名/内容、`DRAFT/ACTIVE/RETIRED`、同编码唯一 ACTIVE 部分索引、内容与身份不可变触发器、提示词索引）。
- 新增 `PromptReleaseService`/`Controller`/`ExceptionHandler`：`POST /prompt-releases`（发布并退休旧 ACTIVE）、`POST /prompt-releases/{id}/retirements`、`GET /prompt-releases`；契约新增 3 个 Schema 与 3 个端点（239 schemas / 247 outputs / 210 operations）。

## 未关闭风险

- A01 仅完成 Prompt release；真实模型评估、Agent/Skill/Tool 目录、预算/fencing/审批与 SSE 恢复未实现，A01 保持 `IN_PROGRESS`。
