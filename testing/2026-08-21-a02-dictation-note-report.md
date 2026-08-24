# A02 听写首切测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（A02 整体仍 `IN_PROGRESS`）  
范围：FR-120–124 / A02 全局 AI 助手·听写（顶栏/浮窗 UI、限频/转任务与动作审批仍待办）

## 结论

A02 全局 AI 助手域新增听写首切：`dictation_note` 记录听写转录文本，状态机 `DRAFT→REVIEWED→SIGNED`。听写安全硬门：转录文本必填且创建后不可篡改（数据库触发器保护 transcript 与身份字段），签署前必须已复核（`SIGN` 仅允许从 `REVIEWED` 推进，状态/时间一致性由数据库约束保证）。身份字段不可变，状态迁移走乐观锁。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。真实语音转写、顶栏/浮窗 UI、限频/转任务与动作审批未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| DN-001 | 创建→复核→签署听写笔记 | DRAFT→REVIEWED→SIGNED | `DictationNoteApiTest.givenNote_…` |
| DN-002 | 未复核即签署 | 拒绝 `DICTATION_NOTE_STATE_INVALID` | `givenInvalidTransition_whenSigningDraft_…` |
| DN-003 | 转录文本不可篡改 | transcript UPDATE 被触发器拒绝 | `givenNoteTranscript_whenTampered_…` |

## 自动化门禁

```text
Java: 66 suites / 218 tests / 0 failure（+1 套件 +3 听写测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 245 schemas / 253 generated outputs / 216 operations
Database: V1-V78 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V78__dictation_note.sql`：`dictation_note`（转录文本、`DRAFT→REVIEWED→SIGNED` 状态机、「签署前必已复核」与状态/时间一致性约束、身份不可变触发器、患者索引）。
- 新增 `DictationNoteService`/`Controller`/`ExceptionHandler`：`POST /dictation-notes`、`POST /dictation-notes/{id}/transitions`（REVIEW/SIGN）、`GET /dictation-notes`；契约新增 3 个 Schema 与 3 个端点（245 schemas / 253 outputs / 216 operations）。

## 未关闭风险

- A02 仅完成听写；真实语音转写、顶栏/浮窗 UI、限频/转任务与动作审批未实现，A02 保持 `IN_PROGRESS`。
