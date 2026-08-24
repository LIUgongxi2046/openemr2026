# A01 Agent 依赖声明与解析首切测试报告

日期：2026-08-22  
状态：`LOCAL_VERIFIED`（A01 整体仍 `IN_PROGRESS`）  
范围：FR-030–037/070–081 / A01 临床知识·模型·Agent·Skill·Tool 受控运行平台（Agent 依赖解析；预算/fencing/审批与 SSE 恢复仍待办）

## 结论

A01 Agent 平台新增依赖声明与解析首切：`agent_dependency` 记录某 Agent 对其使用的 Skill/Tool 的依赖。声明闭环硬门：依赖必须解析到同租户内已登记且 `ACTIVE` 的技能或工具（否则 `AGENT_DEPENDENCY_UNRESOLVABLE`）；同一 Agent 对同一类型/编码的依赖唯一（数据库唯一约束，重复声明拒绝）；依赖身份不可变。解析语义：列表按当前注册表状态重算 `resolved`，技能/工具被停用后其依赖立即显示未解析。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。真实模型/Skill/Tool 运行编排、预算/fencing/审批与 SSE 恢复未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| AD-001 | 声明活动技能依赖 | resolved=true 并列表可见 | `givenActiveSkillDependency_whenDeclaring_thenResolved` |
| AD-002 | 声明活动工具依赖 | resolved=true | `givenActiveToolDependency_whenDeclaring_thenResolved` |
| AD-003 | 依赖不存在的技能 | 拒绝 `AGENT_DEPENDENCY_UNRESOLVABLE` | `givenMissingSkill_whenDeclaring_thenRejected` |
| AD-004 | 依赖停用技能 | 拒绝 `AGENT_DEPENDENCY_UNRESOLVABLE` | `givenInactiveSkill_whenDeclaring_thenRejected` |
| AD-005 | 重复声明同一依赖 | 数据库唯一约束拒绝 | `givenDuplicateDependency_whenDeclaring_thenRejected` |
| AD-006 | 技能停用后解析 | resolved=false | `givenDeactivatedSkill_whenListing_thenResolvedFalse` |

## 自动化门禁

```text
Java: 82 suites / 287 tests / 0 failure（+1 套件 +6 Agent 依赖测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 290 schemas / 298 generated outputs / 260 operations
Database: V1-V94 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V94__agent_dependency.sql`：`agent_dependency`（Agent 外键/依赖类型 SKILL·TOOL/依赖编码、「同 Agent 同类型同编码唯一」约束、身份不可变触发器、Agent 索引）。
- 新增 `AgentDependencyService`/`Controller`/`ExceptionHandler`：`POST /agent-dependencies`（声明时校验依赖解析到活动技能/工具 + 幂等）、`GET /agent-dependencies`（按当前注册表状态返回 `resolved`）；契约新增 2 个 Schema 与 2 个端点（290 schemas / 298 outputs / 260 operations）。

## 未关闭风险

- A01 仅完成 Agent 依赖声明与解析；预算/fencing/审批、SSE 恢复与真实模型/Skill/Tool 运行编排未实现，A01 保持 `IN_PROGRESS`。
