# N01 出院护理闭环首切测试报告

日期：2026-08-22  
状态：`LOCAL_VERIFIED`（N01 整体仍 `IN_PROGRESS`）  
范围：FR-050/096 / N01 护理·出院护理闭环（转区任务迁移与移动床旁离线草稿仍待办）

## 结论

N01 护理域新增出院护理闭环首切：`nursing_discharge_closure` 记录出院护理闭环（闭环人/时间），不可变。出院护理硬门：存在未完成的护理计划（`nursing_care_plan.status='ACTIVE'`）时阻断闭环（服务端 `NURSING_CARE_PLANS_OPEN`），必须先完成或停用全部活动护理计划才能闭环出院。闭环记录整体不可变（`before update or delete` 触发器）。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。给药执行任务未闭环与交接未完项的检查、转区任务迁移与移动床旁离线草稿未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| DC-001 | 无活动护理计划时闭环出院 | 闭环记录正确 | `NursingDischargeClosureApiTest.givenNoOpenCarePlans_…` |
| DC-002 | 存在活动护理计划时闭环 | 拒绝 `NURSING_CARE_PLANS_OPEN` | `givenOpenCarePlan_whenClosing_…` |
| DC-003 | 闭环记录不可篡改 | closed_by UPDATE 被触发器拒绝 | `givenClosure_whenTampered_…` |

## 自动化门禁

```text
Java: 74 suites / 245 tests / 0 failure（+1 套件 +3 出院护理闭环测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 268 schemas / 276 generated outputs / 239 operations
Database: V1-V86 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V86__nursing_discharge_closure.sql`：`nursing_discharge_closure`（闭环人/时间、就诊唯一、整体不可变触发器、患者索引）。
- `NursingService` 增加 `closeNursingDischarge`（活动护理计划阻断硬门）与 `listNursingDischargeClosures`；`NursingController` 增加 `POST /nursing-discharge-closures`、`GET /nursing-discharge-closures`；契约新增 2 个 Schema 与 2 个端点（268 schemas / 276 outputs / 239 operations）。

## 未关闭风险

- N01 仅完成出院护理闭环（活动护理计划维度）；给药执行任务未闭环与交接未完项的检查、转区任务迁移与移动床旁离线草稿未实现，N01 保持 `IN_PROGRESS`。
