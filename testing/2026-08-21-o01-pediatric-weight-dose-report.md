# O01 儿童按体重给药硬门首切测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（O01 整体仍 `IN_PROGRESS`）  
范围：FR-012–014 / O01 用药安全·儿童按体重给药（肝肾剂量仍待办）

## 结论

O01 用药安全新增儿童按体重给药硬门：`medication_catalog_version` 增加 `weight_based` / `min_dose_per_kg` / `max_dose_per_kg`，`patient` 增加 `weight_kg`。签署时 `evaluateSafety` 对按体重给药药品强制校验：

- 患者无有效体重 → `PEDIATRIC_WEIGHT_REQUIRED`（BLOCKING，阻断签署，不产生执行任务）；
- 每公斤剂量 `dose_value / weight_kg` 低于下限 → `DOSE_PER_KG_BELOW_MINIMUM`（BLOCKING）；
- 高于上限 → `DOSE_PER_KG_ABOVE_MAXIMUM`（BLOCKING）。

规则水印升级 `RULESET-MEDICATION-4 → RULESET-MEDICATION-5`（服务端常量、前端 API 与展示、全部测试夹具同步）。数据库约束保证「按体重给药 ⟺ 每公斤上下限同时存在」且下限>0、上限≥下限。

这一结论只适用于本机合成数据。肝/肾功能调整剂量、真实药典剂量上限与规模性能未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| PD-001 | 按体重药品无体重记录 | 阻断 `PEDIATRIC_WEIGHT_REQUIRED`，无执行任务 | `givenWeightBasedMedication_whenMissingWeightOrOutOfRangePerKg_thenBlocked` |
| PD-002 | 每公斤剂量超上限（50 mg/kg > 40） | 阻断 `DOSE_PER_KG_ABOVE_MAXIMUM` | 同上 |
| PD-003 | 每公斤剂量合法（30 mg/kg ∈ [20,40]） | 通过并签署成功 | 同上 |

## 自动化门禁

```text
Java: 55 suites / 173 tests / 0 failure（+1 按体重给药用例）
Web: 5 files / 17 tests / 0 failure
Contracts: 214 schemas / 222 generated outputs / 185 operations（无新增端点）
Database: V1-V66 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V66__pediatric_weight_based_dose.sql`：`medication_catalog_version` 增加按体重给药三列与「按体重 ⟺ 每公斤上下限同时存在」约束；`patient` 增加 `weight_kg`（0.5–500 范围约束）。
- `OrderService.evaluateSafety` 增加按体重给药校验（缺体重/每公斤剂量越界三档 BLOCKING），规则水印升级 `RULESET-MEDICATION-5`。
- 前端 `clinical-api.ts` 与 `OrdersWorkspacePage`、全部测试夹具同步水印；`MedicationSafetyApiTest` 新增按体重给药用例。

## 未关闭风险

- O01 仅完成儿童按体重给药；肝/肾功能调整剂量、任务通知恢复与团队视图仍未实现，O01 保持 `IN_PROGRESS`。
