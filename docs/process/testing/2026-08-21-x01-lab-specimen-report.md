# X01 检验标本首切测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（X01 整体仍 `IN_PROGRESS`）  
范围：FR-043 / X01 检验申请·标本

## 结论

检验标本首切落地：`lab_specimen` 记录标本（类型、状态机 `ORDERED→COLLECTED→RECEIVED`/`REJECTED`、采集/接收人与时间），创建时校验关联医嘱项为 `LAB` 类型且患者/就诊一致（错患者失败关闭）；标本身份（医嘱项/患者/就诊/类型）创建后不可篡改。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。真实 LIS 连接器、标本条码/设备与断点补传未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| LS-001 | 检验标本全链 | `ORDERED→COLLECTED→RECEIVED`，采集/接收时间正确 | `LabSpecimenApiTest.givenLabOrder_…` |
| LS-002 | 非检验医嘱项 | `LAB_SPECIMEN_ORDER_TYPE_INVALID` | `givenNonLabOrderItem_…` |
| LS-003 | 标本身份不可变 | UPDATE 被触发器拒绝 | `givenSpecimenIdentity_whenTampered_…` |

## 自动化门禁

```text
Java: 39 suites / 116 tests / 0 failure（+1 套件 +3 标本测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 173 schemas / 181 generated outputs / 117 operations
Database: V1-V48 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V48__lab_specimen.sql`：`lab_specimen`（标本类型、状态机 `ORDERED→COLLECTED→RECEIVED/REJECTED`、身份不可变触发器、就诊索引）。
- 新增 `LabSpecimenService`/`Controller`/`ExceptionHandler`：`POST /lab-specimens`、`POST /lab-specimens/{id}/collections`、`POST /lab-specimens/{id}/receptions`、`GET /lab-specimens`；契约新增 4 个 Schema。

## 未关闭风险

- 标本未接真实 LIS 连接器、条码/设备与断点补传，报告/危急值闭环仍在 O01 结果内核。
- PACS/影像、病理标本（蜡块/切片）、设备绑定与集成消息箱仍未实现，X01 保持 `IN_PROGRESS`。
