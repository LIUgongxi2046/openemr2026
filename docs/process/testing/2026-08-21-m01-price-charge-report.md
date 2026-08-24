# M01 价格版本与收费明细首切测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（M01 整体仍 `IN_PROGRESS`）  
范围：FR-040/041 / M01 价格版本·收费·退费

## 结论

药房/收费首切落地：`price_catalog_version` 维护版本化价格目录（同一项目多版本，按生效期与 release 版本唯一）；`charge_item` 在收费时冻结单价与金额快照（金额=数量×单价，保留 2 位），退费走「冲正」状态而非删除；价格/金额/数量/单位创建后不可篡改。无活动价格时收费失败关闭。

这一结论只适用于本机合成数据。真实支付渠道、预交/结算/日结、库存与批号效期未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| BC-001 | 按活动价格收费 | 单价/金额快照正确（3×10.50=31.50） | `BillingApiTest.givenActivePrice_…` |
| BC-002 | 退费冲正 | `REVERSED` + 原因，记录保留不删除 | 同一测试 |
| BC-003 | 无活动价格 | `PRICE_NOT_AVAILABLE` | `givenNoActivePrice_…` |
| BC-004 | 重复冲正 | `CHARGE_STATE_INVALID` | `givenReversedCharge_whenReversedAgain_…` |

## 自动化门禁

```text
Java: 38 suites / 113 tests / 0 failure（+1 套件 +3 收费测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 169 schemas / 177 generated outputs / 117 operations
Database: V1-V47 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V47__price_catalog_and_charge.sql`：`price_catalog_version`（版本化价格目录 + 活动价格唯一索引）与 `charge_item`（收费明细，冻结单价/金额快照 + 冲正状态 + 价格字段不可变触发器）。
- 新增 `BillingService`/`BillingController`/`BillingExceptionHandler`：`POST /price-catalogs`、`POST /charges`、`POST /charges/{id}/reversals`、`GET /charges`；契约新增 5 个 Schema。

## 未关闭风险

- 未接真实支付/退款渠道、预交金、结算与日结对账。
- 库存（批号/效期/并发扣减）与门诊审方/调剂/发退药、住院摆药/配液仍未实现，M01 保持 `IN_PROGRESS`。
