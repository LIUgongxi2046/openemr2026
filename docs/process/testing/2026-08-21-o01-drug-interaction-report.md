# O01 药物相互作用硬规则测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（O01 整体仍 `IN_PROGRESS`）  
范围：FR-013 / O01 药物相互作用

## 结论

用药安全硬规则在过敏、重复成分、剂量单位/上下限之外，新增版本化「药物相互作用」目录：`CONTRAINDICATED`（禁忌）在签署时阻断并留证，`MODERATE`（中等）记录为 `WARNING` 但不阻断签署。相互作用在「本单多药品」与「同就诊其他在途/活动医嘱」两个维度按成分对对称匹配，AI 与前端均无法绕过。

这一结论只适用于本机合成数据。真实药典数据、跨库药物知识来源与规模性能未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| DI-001 | 禁忌相互作用（跨医嘱） | `DRUG_INTERACTION`/`BLOCKING`，`passed=false`，签署 409 `MEDICATION_SAFETY_BLOCKED`，执行任务=0 | `MedicationSafetyApiTest.givenContraindicatedInteraction_…` |
| DI-002 | 中等相互作用 | `DRUG_INTERACTION`/`WARNING`，`passed=true`，签署仍成功 | `givenModerateInteraction_…` |
| DI-003 | 规则版本水印 | 规则集升级为 `RULESET-MEDICATION-3`，旧水印被拒绝 | 后端常量 + 前端 + 三个测试文件一致 |
| DI-004 | 相互作用证据不可变 | 目录行 UPDATE/DELETE 被触发器拒绝 | `medication_interaction_immutable` 触发器 + `assert-v38.sql` |

## 自动化门禁

```text
Java: 32 suites / 87 tests / 0 failure（+2 相互作用测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 144 schemas / 152 generated outputs / 117 operations
Database: V1-V38 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V38__medication_drug_interaction.sql`：`medication_interaction` 版本化目录（成分对、严重级别、标题/详情/证据来源、有效期、不可变触发器与成分索引）。
- `OrderService` 扩展：`evaluateSafety` 增加跨医嘱与单内成对相互作用检测，严重级别映射 `CONTRAINDICATED→BLOCKING`、`MODERATE→WARNING`；`SafetyFindingDraft` 增加 severity，`persistSafetyEvaluation` 只按 BLOCKING 计算 `blocking_count`，签署时复检仅对 BLOCKING 阻断。
- 规则水印升级 `RULESET-MEDICATION-2 → RULESET-MEDICATION-3`（后端常量、前端 `clinical-api.ts`、医嘱工作台展示与三个测试文件同步）。

## 未关闭风险

- 相互作用目录目前由测试/合成数据注入，未接真实药典（如国家药品相互作用库）或第三方知识源，也未做目录发布审批与灰度。
- 儿童/肝肾剂量、抗菌药与特殊药品权限、任务过期/通知恢复/团队视图等 O01 剩余项仍未完成。
- 相互作用命中仅在单租户合成规模验证，未做成对匹配在大处方集下的 p95 性能与索引覆盖验收。
