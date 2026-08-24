# N01 移动床旁离线草稿首切测试报告

日期：2026-08-22  
状态：`LOCAL_VERIFIED`（N01 整体仍 `IN_PROGRESS`）  
范围：FR-021/090 / N01 护理·移动床旁离线草稿（转区任务迁移、给药执行任务未闭环检查仍待办）

## 结论

N01 护理病区新增移动床旁离线草稿首切：`nursing_bedside_note` 记录床旁护理观察，保存离线设备本地记录时间 `recorded_at` 与同步到服务器时间 `synced_at` 双时间戳。离线补录双时间硬门：`recorded_at` 不得晚于 `synced_at`（数据库约束 `recorded_at <= synced_at` + 服务端清晰错误码 `NURSING_BEDSIDE_NOTE_TIME_ORDER_INVALID`）；记录身份（患者/就诊/院区/类型/双时间/设备/内容）整体不可变，杜绝同步后篡改；绑定患者×就诊×院区并要求活动就诊（`ARRIVED/IN_PROGRESS/SUSPENDED`），同步幂等重放不重复（`IDEMPOTENCY_REPLAY`）。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。真实移动端断网队列与设备时钟漂移容限未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| NB-001 | 离线记录同步并列表 | 双时间戳原样落库 | `givenOfflineNote_whenSyncingAndListing_thenRecordedWithDualTimestamp` |
| NB-002 | 记录时间晚于同步时间 | 拒绝 `NURSING_BEDSIDE_NOTE_TIME_ORDER_INVALID` | `givenRecordedAfterSynced_whenSyncing_thenRejected` |
| NB-003 | 绕过服务直接写逆行双时间 | 数据库约束拒绝 | `givenRecordedAfterSynced_whenBypassingService_thenDatabaseRejects` |
| NB-004 | 同步后篡改内容 | 不可变触发器拒绝 | `givenNoteIdentity_whenTampered_thenDatabaseRejectsMutation` |
| NB-005 | 相同幂等键重放 | 拒绝 `IDEMPOTENCY_REPLAY` | `givenSameIdempotencyKey_whenSyncingTwice_thenRejected` |

## 自动化门禁

```text
Java: 79 suites / 266 tests / 0 failure（+1 套件 +5 床旁离线草稿测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 280 schemas / 288 generated outputs / 251 operations
Database: V1-V91 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V91__nursing_bedside_note.sql`：`nursing_bedside_note`（记录/同步双时间戳、类型 VITAL_SIGNS/INTAKE_OUTPUT/NURSING_NOTE、设备标识、「记录时间不得晚于同步时间」数据库约束、身份不可变触发器、患者索引）。
- `NursingService` 增加 `syncBedsideNote`（双时间时序硬门 + 活动就诊硬门 + 幂等）/`listBedsideNotes`；`NursingController` 增加 `POST /nursing-bedside-notes`、`GET /nursing-bedside-notes`；契约新增 2 个 Schema 与 2 个端点（280 schemas / 288 outputs / 251 operations）。

## 未关闭风险

- N01 仅完成移动床旁离线草稿；转区任务迁移、给药执行任务未闭环与交接未完项检查、移动端断网队列与真实时钟漂移容限未实现，N01 保持 `IN_PROGRESS`。
