# N01 床旁给药五对核验测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（N01 整体仍 `IN_PROGRESS`）  
范围：FR-042 / N01 床旁给药五对核验

## 结论

床旁给药「五对核验」首切落地：`medication_administration` 记录给药事实（执行任务、药品、剂量、途径、给药时间），服务端在写入前核验「患者×就诊」与「药品/剂量/途径」是否与医嘱执行任务一致（错患者/错药品/错剂量/错途径分别拒绝），并要求执行人与核对人为两名不同人员（双人核验）；给药记录不可变。

这一结论只适用于本机合成数据。真实 PDA/移动床旁扫描、停嘱竞态与离线补录未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| MA-001 | 五对一致给药 | 落库，`administered_by`/`verified_by` 为两名不同人员 | `MedicationAdministrationApiTest.givenMatchingFiveRights_…` |
| MA-002 | 错药品 | `FIVE_RIGHTS_DRUG_MISMATCH` | `givenMismatchedDrug_…` |
| MA-003 | 双人核验缺失 | 自核验拒绝 | `givenSelfVerification_…` |
| MA-004 | 给药记录不可变 | UPDATE/DELETE 被触发器拒绝 | `givenAdministrationRecord_whenTampered_…` |

## 自动化门禁

```text
Java: 36 suites / 107 tests / 0 failure（+1 套件 +4 给药核验测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 161 schemas / 169 generated outputs / 117 operations
Database: V1-V45 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V45__medication_administration.sql`：`medication_administration`（执行任务、五对字段、给药/核对人 + `administered_by <> verified_by` 双人约束 + 不可变触发器 + 就诊索引）。
- `NursingService` 增加 `administerMedication`（五对核验 + 双人核验）与 `listMedicationAdministrations`；契约新增 `MedicationAdministration`、`MedicationAdministrationRequest` 与 2 个端点。

## 未关闭风险

- 五对中的「时间」仅记录给药时间，未接医嘱频次/执行窗口校验与停嘱竞态拦截。
- 高风险药品的额外双人签名、交接班、转区任务迁移与移动床旁离线草稿仍未实现，N01 保持 `IN_PROGRESS`。
