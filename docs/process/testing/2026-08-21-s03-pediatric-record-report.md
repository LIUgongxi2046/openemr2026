# S03 儿科专科·儿科记录首切测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（S01–S10 专科包整体仍 `IN_PROGRESS`）  
范围：FR-131 / S03 儿科（record 层首切）

## 结论

儿科专科包 record 层首切落地：`pediatric_record` 记录监护人姓名/关系（母/父/法定监护人/其他）、监护人电话、月龄（0–216 月）、最新体重（0.5–250 kg）、测量时间与危重标记；身份字段（患者/就诊/监护人/月龄/体重/测量时间）创建后不可篡改。月龄与体重越界在服务端硬门拒绝。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。儿童剂量计算、危重升级流、生长发育曲线与随访六层未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| PR-001 | 创建并列表儿科记录 | 关系/月龄/体重/危重/状态正确 | `PediatricRecordApiTest.givenPediatricPatient_…` |
| PR-002 | 体重越界（300 kg） | 拒绝 `PEDIATRIC_REQUEST_INVALID` | `givenOutOfRangeWeight_…` |
| PR-003 | 记录身份不可变 | 月龄 UPDATE 被触发器拒绝 | `givenRecordIdentity_whenTampered_…` |

## 自动化门禁

```text
Java: 48 suites / 143 tests / 0 failure（+1 套件 +3 儿科测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 200 schemas / 208 generated outputs / 171 operations
Database: V1-V58 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V58__pediatric_record.sql`：`pediatric_record`（监护人姓名/关系/电话、月龄 0–216、体重 0.5–250、测量时间、危重标记、身份不可变触发器、患者状态索引）。
- 新增 `PediatricService`/`Controller`/`ExceptionHandler`：`POST /pediatric-records`、`GET /pediatric-records`；契约新增 2 个 Schema 与 2 个端点（200 schemas / 208 outputs / 171 operations）。

## 台账校正

- 既往 README 与 S01/S02 报告沿用 `117 operations`（自 V37 后未随契约增长更新）；本批以生成器 `api-index.json` 的 `operation_count` 为准，回正为 171。

## 未关闭风险

- S03 仅完成 record 层；儿童剂量计算、危重升级、生长发育曲线、营养/喂养与随访等六层未实现，S01–S10 保持 `IN_PROGRESS`。
