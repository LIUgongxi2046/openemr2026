# G01 字典主数据首切测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（G01 整体仍 `IN_PROGRESS`）  
范围：FR-062/063 / G01 字典主数据

## 结论

配置平台字典主数据首切落地：`dictionary_item` 维护按字典编码分组的编码值（`ACTIVE/INACTIVE`、生效期），同一字典编码内条目唯一；条目编码/名称创建后不可篡改，停用记录生效结束日期。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。真实多机构字典继承、配置包升级三方差异与沙箱/灰度未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| DI-001 | 创建/列表/停用字典项 | `ACTIVE→INACTIVE`，`effective_to` 回填 | `DictionaryApiTest.givenDictionaryCode_…` |
| DI-002 | 重复条目编码 | 唯一约束拒绝 | `givenDuplicateItemCode_…` |
| DI-003 | 条目编码不可变 | UPDATE 被触发器拒绝 | `givenDictionaryItemCode_whenTampered_…` |

## 自动化门禁

```text
Java: 42 suites / 124 tests / 0 failure（+1 套件 +3 字典测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 182 schemas / 190 generated outputs / 117 operations
Database: V1-V51 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V51__dictionary_master_data.sql`：`dictionary_item`（字典编码分组、状态 `ACTIVE/INACTIVE`、生效期、编码不可变触发器、字典索引）。
- 新增 `DictionaryService`/`Controller`/`ExceptionHandler`：`POST /dictionary-items`、`POST /dictionary-items/{id}/deactivations`、`GET /dictionary-items`；契约新增 3 个 Schema。

## 未关闭风险

- 未实现多机构字典继承、能力包继承与配置包升级三方差异。
- 流程/状态/表单/模板/规则/权限/接口可视化配置、沙箱/审批/灰度/回滚仍未实现，G01 保持 `IN_PROGRESS`。
