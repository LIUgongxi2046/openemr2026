# S09 皮肤科专科·皮肤记录首切测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（S01–S10 专科包整体仍 `IN_PROGRESS`）  
范围：FR-137 / S09 皮肤（record 层首切）

## 结论

皮肤科专科包 record 层首切落地：`dermatology_record` 记录病理部位（SCALP/FACE/NECK/TRUNK/UPPER_EXTREMITY/LOWER_EXTREMITY/PALMOPLANTAR/GENITAL/MUCOSAL/OTHER）、受累体表面积 BSA（0–100%）与 PASI 评分（0–72，银屑病面积与严重指数）。BSA 与 PASI 越界在服务端硬门拒绝，数据库检查约束双保险。身份/部位/BSA/PASI 字段创建后不可篡改。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。影像授权、生物制剂筛查、皮损图谱与专科 AI eval 未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| SR-001 | 创建并列表皮肤记录 | 部位/BSA/PASI/状态正确 | `DermatologyRecordApiTest.givenPatient_…` |
| SR-002 | BSA 越界（120%） | 拒绝 `DERMATOLOGY_REQUEST_INVALID` | `givenOutOfRangeBsa_…` |
| SR-003 | PASI 越界（80） | 拒绝 `DERMATOLOGY_REQUEST_INVALID` | `givenOutOfRangePasi_…` |
| SR-004 | 记录身份不可变 | 部位 UPDATE 被触发器拒绝 | `givenRecordIdentity_whenTampered_…` |

## 自动化门禁

```text
Java: 54 suites / 168 tests / 0 failure（+1 套件 +4 皮肤测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 212 schemas / 220 generated outputs / 183 operations
Database: V1-V64 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V64__dermatology_record.sql`：`dermatology_record`（病理部位、BSA 0–100、PASI 0–72、身份不可变触发器、患者索引）。
- 新增 `DermatologyService`/`Controller`/`ExceptionHandler`：`POST /dermatology-records`、`GET /dermatology-records`；契约新增 2 个 Schema 与 2 个端点（212 schemas / 220 outputs / 183 operations）。

## 未关闭风险

- S09 仅完成 record 层；影像授权、生物制剂筛查、皮损图谱与随访六层未实现，S01–S10 保持 `IN_PROGRESS`。
