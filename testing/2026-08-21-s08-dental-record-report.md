# S08 口腔专科·口腔记录首切测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（S01–S10 专科包整体仍 `IN_PROGRESS`）  
范围：FR-136 / S08 口腔（record 层首切）

## 结论

口腔专科包 record 层首切落地：`dental_record` 记录 FDI 牙位（`tooth_notation`，双位编码，恒牙象限 1–4/牙 1–8、乳牙象限 5–8/牙 1–5）与操作牙位（`procedure_tooth`）。操作牙位安全硬门：操作牙位必须与记录牙位一致（防术牙错误），非法 FDI 编码与操作牙位不匹配在服务端硬门拒绝，数据库检查约束双保险（格式 `^[1-8][1-8]$`、恒/乳牙牙位范围、操作牙位须等于记录牙位）。身份/牙位/操作牙位字段创建后不可篡改。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。影像标注、材料批次、修复体与专科 AI eval 未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| DR-001 | 创建并列表口腔记录 | FDI 牙位/操作牙位/状态正确 | `DentalRecordApiTest.givenPatient_…` |
| DR-002 | 非法 FDI 编码（19） | 拒绝 `DENTAL_REQUEST_INVALID` | `givenInvalidFdiNotation_…` |
| DR-003 | 操作牙位不匹配（11 vs 12） | 拒绝 `DENTAL_REQUEST_INVALID` | `givenProcedureToothMismatch_…` |
| DR-004 | 记录身份不可变 | 牙位 UPDATE 被触发器拒绝 | `givenRecordIdentity_whenTampered_…` |

## 自动化门禁

```text
Java: 53 suites / 164 tests / 0 failure（+1 套件 +4 口腔测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 210 schemas / 218 generated outputs / 181 operations
Database: V1-V63 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V63__dental_record.sql`：`dental_record`（FDI 牙位与操作牙位、「操作牙位须等于记录牙位」硬约束、恒/乳牙牙位范围校验、身份不可变触发器、患者索引）。
- 新增 `DentalService`/`Controller`/`ExceptionHandler`：`POST /dental-records`、`GET /dental-records`；契约新增 2 个 Schema 与 2 个端点（210 schemas / 218 outputs / 181 operations）。

## 未关闭风险

- S08 仅完成 record 层；影像标注、材料批次、治疗与随访等六层未实现，S01–S10 保持 `IN_PROGRESS`。
