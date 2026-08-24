# A01 模型目录首切测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（A01 整体仍 `IN_PROGRESS`）  
范围：FR-030/031 / A01 模型目录

## 结论

AI 平台模型目录首切落地：`model_deployment` 登记模型（模型编码、供应商、驻留策略 `ON_PREM_ONLY/LOCAL_PREFERRED/CLOUD_ALLOWED`、端点、评估状态），模型编码与供应商创建后不可篡改，`CLOUD_ALLOWED` 强制要求端点；停用模型不删除目录。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。真实模型评估（TTFT/tokens/s/峰值显存）、Prompt release、Agent/Skill/Tool 目录与 DeepSeek 本地 Harness 未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| MD-001 | 登记/列表/停用模型 | `ACTIVE→INACTIVE`，驻留策略正确 | `ModelDeploymentApiTest.givenModel_…` |
| MD-002 | 重复模型编码 | 唯一约束拒绝 | `givenDuplicateModelCode_…` |
| MD-003 | 模型编码不可变 | UPDATE 被触发器拒绝 | `givenModelCode_whenTampered_…` |

## 自动化门禁

```text
Java: 43 suites / 127 tests / 0 failure（+1 套件 +3 模型目录测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 185 schemas / 193 generated outputs / 117 operations
Database: V1-V52 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V52__model_deployment_catalog.sql`：`model_deployment`（模型编码/供应商/驻留策略/端点/评估状态、编码不可变触发器、活动索引）。
- 新增 `ModelDeploymentService`/`Controller`/`ExceptionHandler`：`POST /model-deployments`、`POST /model-deployments/{id}/deactivations`、`GET /model-deployments`；契约新增 3 个 Schema。

## 未关闭风险

- 未接真实模型评估基线（TTFT/tokens/s/峰值显存/超时/取消）、Prompt release 与模型路由。
- Agent/Skill/Tool 目录、受控运行预算/fencing/审批/SSE 恢复与 DeepSeek 本地 Harness 仍未实现，A01 保持 `IN_PROGRESS`。
