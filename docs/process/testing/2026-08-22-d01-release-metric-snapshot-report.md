# D01 开源指标快照首切测试报告

日期：2026-08-22  
状态：`LOCAL_VERIFIED`（D01 整体仍 `IN_PROGRESS`）  
范围：FR-029/054/055/106/107 / D01 数据中心·开源指标（真实下载口径去重仍待办）

## 结论

D01 开源指标新增发布指标快照首切：`release_metric_snapshot` 记录开源发布的 Stars/下载量/活跃安装数等指标快照。指标闭环硬门：指标值非负（数据库约束 + 服务端）；来源非空；同「指标类型 + 来源 + 快照日期」唯一（数据库唯一约束，防同一来源同日的重复快照/虚假计数）；身份不可变。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。真实下载机器人排除口径与多渠道聚合未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| RMS-001 | 记录指标快照 | 落库并列表可见 | `givenSnapshot_whenRecording_thenRecorded` |
| RMS-002 | 同来源同日重复快照 | 数据库唯一约束拒绝 | `givenDuplicateSnapshot_whenRecording_thenRejected` |
| RMS-003 | 负指标值 | 拒绝 `RELEASE_METRIC_REQUEST_INVALID` | `givenNegativeMetricValue_whenRecording_thenRejected` |

## 自动化门禁

```text
Java: 98 suites / 362 tests / 0 failure（+1 套件 +3 开源指标快照测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 324 schemas / 332 generated outputs / 293 operations
Database: V1-V110 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V110__release_metric_snapshot.sql`：`release_metric_snapshot`（指标类型 STARS·DOWNLOADS·ACTIVE_INSTALLS/指标值/来源/快照日期、「指标值非负」「同类型同来源同日唯一」约束、身份不可变触发器、类型索引）。
- 新增 `ReleaseMetricSnapshotService`/`Controller`/`ExceptionHandler`：`POST /release-metric-snapshots`（非负 + 唯一去重 + 幂等）、`GET /release-metric-snapshots`；契约新增 2 个 Schema 与 2 个端点（324 schemas / 332 outputs / 293 operations）。

## 未关闭风险

- D01 仅完成开源指标快照；真实下载机器人排除口径、多渠道聚合与有效下载去重未实现，D01 保持 `IN_PROGRESS`。
