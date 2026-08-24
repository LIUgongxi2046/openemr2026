# A01 模型评估首切测试报告

日期：2026-08-22  
状态：`LOCAL_VERIFIED`（A01 整体仍 `IN_PROGRESS`）  
范围：FR-030–037/056/070–081 / A01 AI 平台·模型评估（预算/fencing/审批与 SSE 恢复仍待办）

## 结论

A01 AI 平台新增模型评估首切：`model_evaluation` 记录模型部署评估（评估名、得分 0–1、阈值 0–1、结论 PASSED/FAILED）。评估治理硬门：结论与得分/阈值一致（数据库约束 `check ((status='PASSED') = (score >= threshold))`，服务端按 `score >= threshold` 自动判定结论），得分/阈值必须在 0–1。评估记录整体不可变（`before update or delete` 触发器）。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。真实评估数据集、预算/fencing/审批与 SSE 恢复未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| ME-001 | 达标得分（0.9 ≥ 0.8） | PASSED | `ModelEvaluationApiTest.givenPassingScore_…` |
| ME-002 | 未达标得分（0.5 < 0.8） | FAILED | `givenFailingScore_…` |
| ME-003 | 得分越界（1.5） | 拒绝 `MODEL_EVALUATION_REQUEST_INVALID` | `givenOutOfRangeScore_…` |
| ME-004 | 评估记录不可篡改 | score UPDATE 被触发器拒绝 | `givenEvaluation_whenTampered_…` |

## 自动化门禁

```text
Java: 75 suites / 249 tests / 0 failure（+1 套件 +4 模型评估测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 270 schemas / 278 generated outputs / 241 operations
Database: V1-V87 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V87__model_evaluation.sql`：`model_evaluation`（评估名/得分/阈值/结论、`结论与得分阈值一致` 数据库约束、整体不可变触发器、模型索引）。
- 新增 `ModelEvaluationService`/`Controller`/`ExceptionHandler`：`POST /model-evaluations`（自动判定 PASSED/FAILED）、`GET /model-evaluations`；契约新增 2 个 Schema 与 2 个端点（270 schemas / 278 outputs / 241 operations）。

## 未关闭风险

- A01 仅完成模型评估；真实评估数据集、预算/fencing/审批与 SSE 恢复未实现，A01 保持 `IN_PROGRESS`。
