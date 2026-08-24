# O01 抗菌药/特殊药品处方授权硬规则测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（O01 整体仍 `IN_PROGRESS`）  
范围：FR-013 / O01 抗菌药与特殊药品权限

## 结论

药品目录新增版本化「处方限制」标注（`RESTRICTED_ANTIBIOTIC`/`CONTROLLED_SUBSTANCE`/`SPECIAL_USE`）。受限药品在签署前必须存在针对「该患者 × 该就诊 × 该药品」的有效处方授权记录，否则签署被硬阻断并留证；授权记录本身不可篡改。AI 与前端均无法绕过。

这一结论只适用于本机合成数据。真实抗菌药物管理（AMS）委员会审批流程、处方权限角色映射与规模性能未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| RM-001 | 受限药品无有效授权 | `RESTRICTED_MEDICATION_AUTHORIZATION_REQUIRED`/`BLOCKING`，`passed=false`，签署 409，执行任务=0 | `MedicationSafetyApiTest.givenRestrictedMedication_…` |
| RM-002 | 取得有效授权后 | `passed=true`，签署成功 | 同一测试后半段 |
| RM-003 | 授权记录不可变 | UPDATE/DELETE 被触发器拒绝 | `medication_prescribing_authorization_immutable` + `assert-v39.sql` |
| RM-004 | 规则版本水印 | 规则集升级为 `RULESET-MEDICATION-4` | 后端常量 + 前端 + 三个测试文件一致 |

## 自动化门禁

```text
Java: 32 suites / 88 tests / 0 failure（+1 受限药品测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 144 schemas / 152 generated outputs / 117 operations
Database: V1-V39 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V39__restricted_medication_authorization.sql`：`medication_catalog_version` 增加 `prescribing_restriction_code` 列与取值约束；新增 `medication_prescribing_authorization` 授权表（患者/就诊/药品/限制类别、审批人、有效期、不可变触发器与活动索引）。
- `OrderService` 扩展：`evaluateSafety` 对带限制标注的药品校验活动授权，缺失时生成 `RESTRICTED_MEDICATION_AUTHORIZATION_REQUIRED` BLOCKING 发现；`MedicationItem` 增加 `drugCode` 与 `prescribingRestrictionCode`。
- 规则水印升级 `RULESET-MEDICATION-3 → RULESET-MEDICATION-4`（后端常量、前端 `clinical-api.ts`、医嘱工作台展示与三个测试文件同步）。

## 未关闭风险

- 授权目前由测试/合成数据注入，未接真实 AMS 审批流、处方权限角色映射（如感染科/特殊处方权）与授权到期自动失效任务。
- 儿童/肝肾剂量、任务过期/通知恢复/团队视图、文书/会诊/路径/出院/Agent 等任务来源等 O01 剩余项仍未完成。
- 受限药品判定仅在单租户合成规模验证，未做大批量处方下的索引覆盖与 p95 性能验收。
