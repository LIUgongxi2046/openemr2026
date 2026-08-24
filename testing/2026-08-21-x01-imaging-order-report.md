# X01 影像检查预约闭环首切测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（X01 整体仍 `IN_PROGRESS`）  
范围：FR-043/044/048 / X01 PACS·影像检查预约（病理/设备/消息箱仍待办）

## 结论

X01 PACS 集成新增影像检查预约闭环首切：`imaging_order` 记录检查方式（CT/MRI/XRAY/ULTRASOUND）、检查部位、侧别（NONE/LEFT/RIGHT/BILATERAL）、是否需造影剂与状态机 `ORDERED→PERFORMED→REPORTED`（及 `ORDERED→CANCELLED`）。检查部位安全硬门：成对部位（上肢/下肢）必须指定侧别（`check (body_part not in (…'UPPER_EXTREMITY','LOWER_EXTREMITY') or laterality <> 'NONE')`，服务端双保险），杜绝无侧别的肢体检查。状态机时间约束（performed_at ≥ ordered_at、reported_at ≥ performed_at）与状态/时间一致性由数据库约束保证；身份字段不可变，状态迁移走乐观锁。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。真实 PACS 连接器/调阅、病理与设备消息箱未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| IO-001 | 创建并执行/报告影像检查 | ORDERED→PERFORMED→REPORTED | `ImagingOrderApiTest.givenOrder_…` |
| IO-002 | 成对部位无侧别 | 拒绝 `IMAGING_ORDER_REQUEST_INVALID` | `givenPairedBodyPartWithoutLaterality_…` |
| IO-003 | 非法状态迁移（ORDERED 直接 REPORT） | 拒绝 `IMAGING_ORDER_STATE_INVALID` | `givenInvalidTransition_…` |
| IO-004 | 检查身份不可变 | 部位 UPDATE 被触发器拒绝 | `givenOrderIdentity_whenTampered_…` |

## 自动化门禁

```text
Java: 59 suites / 189 tests / 0 failure（+1 套件 +4 影像检查测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 224 schemas / 232 generated outputs / 195 operations
Database: V1-V71 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V71__imaging_order.sql`：`imaging_order`（方式/部位/侧别/造影剂、`ORDERED→PERFORMED→REPORTED/CANCELLED` 状态机、「成对部位必填侧别」与状态/时间一致性约束、身份不可变触发器、患者索引）。
- 新增 `ImagingOrderService`/`Controller`/`ExceptionHandler`：`POST /imaging-orders`、`POST /imaging-orders/{id}/transitions`（PERFORM/REPORT/CANCEL）、`GET /imaging-orders`；契约新增 3 个 Schema 与 3 个端点（224 schemas / 232 outputs / 195 operations）。

## 未关闭风险

- X01 仅完成影像检查预约闭环；真实 PACS 连接器/调阅、病理、设备与消息箱未实现，X01 保持 `IN_PROGRESS`。
