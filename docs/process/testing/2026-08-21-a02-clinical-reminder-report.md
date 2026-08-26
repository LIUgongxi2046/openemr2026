# A02 全局 AI医助小南·主动提醒首切测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（A02 整体仍 `IN_PROGRESS`）  
范围：FR-120/121 / A02 主动提醒

## 结论

全局 AI医助小南主动提醒首切落地：`clinical_reminder` 记录提醒类型（药物相互作用/超期任务/危急值/异常体征/随访到期/其他）、消息、严重程度与状态机 `PENDING→ACKNOWLEDGED/SILENCED`；内容创建后不可篡改，可关联来源任务；静默与确认记录操作人与时间。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。真实顶栏/浮窗/快捷键 UI、提醒限频与转任务、听写转写与动作审批未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| CR-001 | 创建并确认提醒 | `PENDING→ACKNOWLEDGED`，确认时间正确 | `ClinicalReminderApiTest.givenActiveEncounter_…` |
| CR-002 | 静默提醒 | `PENDING→SILENCED`，静默时间正确 | `givenPendingReminder_whenSilenced_…` |
| CR-003 | 提醒内容不可变 | 消息 UPDATE 被触发器拒绝 | `givenReminderContent_whenTampered_…` |

## 自动化门禁

```text
Java: 46 suites / 136 tests / 0 failure（+1 套件 +3 提醒测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 196 schemas / 204 generated outputs / 117 operations
Database: V1-V56 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V56__clinical_reminder.sql`：`clinical_reminder`（提醒类型/消息/严重程度、状态机 `PENDING→ACKNOWLEDGED/SILENCED`、内容不可变触发器、就诊索引）。
- 新增 `ClinicalReminderService`/`Controller`/`ExceptionHandler`：`POST /clinical-reminders`、`/acknowledgements`、`/silences`、`GET /clinical-reminders`；契约新增 4 个 Schema。

## 未关闭风险

- 未接顶栏/浮窗/快捷键 UI、提醒限频/转任务、显式录音转写与结构化动作审批。
- 提醒目前由命令驱动，未接 AI 主动生成提醒（由 A01 模型运行时触发）与效果/安全指标，A02 保持 `IN_PROGRESS`。
