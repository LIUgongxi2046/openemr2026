# D01 科研数据集申请首切测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（D01 整体仍 `IN_PROGRESS`）  
范围：FR-054/055/106 / D01 科研数据集

## 结论

科研数据集申请首切落地：`research_dataset_request` 记录研究目的、范围与状态机 `REQUESTED→APPROVED→EXPORTED→DESTROYED/REJECTED`，导出记录脱敏水印，销毁记录销毁人与时间；目的/范围创建后不可篡改；全程审计与 Outbox 同事务，可撤销/可追踪。

这一结论只适用于本机合成数据。真实脱敏算法、导出内容与水印/重识别风险未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| RD-001 | 申请→批准→导出→销毁 | 全生命周期状态机与水印正确 | `ResearchDatasetApiTest.givenRequest_…` |
| RD-002 | 未批准导出 | `RESEARCH_DATASET_STATE_INVALID` | `givenRequestedDataset_whenExportedWithoutApproval_…` |
| RD-003 | 目的不可变 | UPDATE 被触发器拒绝 | `givenDatasetPurpose_whenTampered_…` |

## 自动化门禁

```text
Java: 44 suites / 130 tests / 0 failure（+1 套件 +3 科研数据集测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 190 schemas / 198 generated outputs / 117 operations
Database: V1-V54 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V53__research_dataset_request.sql`：`research_dataset_request`（目的/范围、状态机 `REQUESTED→APPROVED→EXPORTED→DESTROYED/REJECTED`、目的不可变触发器、状态索引）；`V54` 修正导出时间戳的单调约束（`EXPORTED/DESTROYED` 均保留 `exported_at`）。
- 新增 `ResearchDatasetService`/`Controller`/`ExceptionHandler`：`POST /research-dataset-requests`、`/approvals`、`/exports`、`/destructions`、`GET /research-dataset-requests`；契约新增 5 个 Schema。

## 未关闭风险

- 未接真实脱敏算法、导出内容与水印生成，重识别风险未做正式评估。
- 队列构建、指标语义层与开源指标（Stars/下载口径快照）仍未实现，D01 保持 `IN_PROGRESS`。
