# O01 肝肾不全禁忌硬门首切测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（O01 整体仍 `IN_PROGRESS`）  
范围：FR-012–014 / O01 用药安全·肝肾不全禁忌（儿童按体重给药已完成）

## 结论

O01 用药安全新增肝肾不全禁忌硬门：`medication_catalog_version` 增加 `renal_contraindication_stage`（MODERATE/SEVERE）与 `hepatic_contraindication_class`（B/C），`patient` 增加 `renal_impairment_stage`（MILD/MODERATE/SEVERE）与 `hepatic_impairment_class`（A/B/C）。签署时 `evaluateSafety` 对目录标注禁忌的药品校验：

- 患者肾功能分期 ≥ 药品禁忌分期 → `RENAL_IMPAIRMENT_CONTRAINDICATION`（BLOCKING，阻断签署）；
- 患者肝功能 Child-Pugh 分级 ≥ 药品禁忌分级 → `HEPATIC_IMPAIRMENT_CONTRAINDICATION`（BLOCKING）。

规则水印升级 `RULESET-MEDICATION-5 → RULESET-MEDICATION-6`（服务端常量、前端 API 与展示、全部测试夹具同步）。数据库约束限制禁忌分期只可取 MODERATE/SEVERE、禁忌分级只可取 B/C（轻度损害不作为禁忌阈值）。

这一结论只适用于本机合成数据。真实 eGFR/CKD 分期与 Child-Pugh 评估来源、剂量减量算法与规模性能未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| HR-001 | 肾功能禁忌药品、患者无损害 | 通过 | `givenRenalOrHepaticContraindication_…` |
| HR-002 | 肾功能禁忌药品、患者 SEVERE | 阻断 `RENAL_IMPAIRMENT_CONTRAINDICATION` | 同上 |
| HR-003 | 肝功能禁忌药品（C 级）、患者 C 级 | 阻断 `HEPATIC_IMPAIRMENT_CONTRAINDICATION` | 同上 |

## 自动化门禁

```text
Java: 55 suites / 174 tests / 0 failure（+1 肝肾禁忌用例）
Web: 5 files / 17 tests / 0 failure
Contracts: 214 schemas / 222 generated outputs / 185 operations（无新增端点）
Database: V1-V67 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V67__hepatic_renal_dose_contraindication.sql`：`medication_catalog_version` 增加肾/肝禁忌阈值列（数据库约束限值域），`patient` 增加肾功能分期与肝功能分级列。
- `OrderService.evaluateSafety` 增加肾/肝禁忌校验（`renalRank`/`hepaticRank` 严重度排序，分期/分级达到禁忌阈值即 BLOCKING），规则水印升级 `RULESET-MEDICATION-6`。
- 前端与全部测试夹具同步水印；`MedicationSafetyApiTest` 新增肾/肝禁忌用例。

## 未关闭风险

- O01 仅完成肝肾禁忌阈值；真实肾/肝功能评估来源、剂量减量算法、任务通知恢复与团队视图仍未实现，O01 保持 `IN_PROGRESS`。
