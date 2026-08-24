# N01 护理计划测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（N01 整体仍 `IN_PROGRESS`）  
范围：FR-050 / N01 护理计划

## 结论

护理计划首切落地：`nursing_care_plan` 记录护理问题、目标、措施、评价、优先级与状态（`ACTIVE→COMPLETED/DISCONTINUED`），护理问题/目标/措施/优先级创建后不可篡改；完成/停用记录完成人与时间并回填评价。计划绑定「患者×就诊×院区」，事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。真实护理评估量表、转区计划迁移与移动端离线草稿未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| NP-001 | 创建计划 | 落库并按优先级列出，`created_by` 正确 | `NursingCarePlanApiTest.givenActiveEncounter_…` |
| NP-002 | 完成计划 | `COMPLETED` + 完成时间 + 评价回填 | 同一测试 |
| NP-003 | 内容不可变 | 护理问题/目标/措施 UPDATE 被触发器拒绝 | `givenCarePlanContent_whenTampered_…` |
| NP-004 | 重复完成 | `NURSING_CARE_PLAN_STATE_INVALID` | `givenCompletedCarePlan_whenCompletedAgain_…` |

## 自动化门禁

```text
Java: 35 suites / 103 tests / 0 failure（+1 套件 +3 护理计划测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 159 schemas / 167 generated outputs / 117 operations
Database: V1-V44 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V44__nursing_care_plan.sql`：`nursing_care_plan`（问题/目标/措施/评价/优先级/状态 + 内容不可变触发器 + 就诊索引）。
- `NursingService` 增加 `createCarePlan`/`listCarePlans`/`completeCarePlan`；契约新增 `NursingCarePlan`、`NursingCarePlanRequest`、`NursingCarePlanCompleteRequest` 与 3 个端点。

## 未关闭风险

- 护理计划为单条「问题—目标—措施—评价」结构，未建模多问题/多措施的分层计划与标准化护理诊断编码（NANDA/NIC/NOC）。
- 护理记录、床旁五对核验、交接班、转区任务迁移与移动床旁离线草稿仍未实现，N01 保持 `IN_PROGRESS`。
