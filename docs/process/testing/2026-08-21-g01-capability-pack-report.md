# G01 能力包首切测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（G01 整体仍 `IN_PROGRESS`）  
范围：FR-062–069/108–119 / G01 配置平台·能力包（可视化配置与沙箱/灰度仍待办）

## 结论

G01 配置平台新增能力包首切：`capability_pack` 记录能力包编码、名称与继承关系（`inherits_from`），状态 `ACTIVE/INACTIVE`。继承治理硬门：能力包编码唯一且不可变（数据库唯一约束 + 触发器保护 pack_code/inherits_from），禁止自继承（`check (inherits_from is null or inherits_from <> pack_code)` + 服务端双保险），继承目标必须引用已存在的能力包（自引用外键）。事件、审计与 Outbox 同事务。

这一结论只适用于本机合成数据。继承环检测、可视化配置与沙箱/灰度发布未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| CP-001 | 定义基础包与继承子包并列表 | ACTIVE 且继承正确 | `CapabilityPackApiTest.givenPack_…` |
| CP-002 | 自继承 | 拒绝 `CAPABILITY_PACK_REQUEST_INVALID` | `givenSelfInheritance_…` |
| CP-003 | 停用活动能力包 | ACTIVE→INACTIVE | `givenActivePack_whenDeactivating_…` |
| CP-004 | 能力包身份不可变 | pack_code UPDATE 被触发器拒绝 | `givenPackIdentity_whenTampered_…` |

## 自动化门禁

```text
Java: 70 suites / 232 tests / 0 failure（+1 套件 +4 能力包测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 257 schemas / 265 generated outputs / 228 operations
Database: V1-V82 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V82__capability_pack.sql`：`capability_pack`（能力包编码/名称/继承关系、`ACTIVE/INACTIVE`、编码唯一 + 禁止自继承 + 身份不可变触发器、状态索引）。
- 新增 `CapabilityPackService`/`Controller`/`ExceptionHandler`：`POST /capability-packs`、`POST /capability-packs/{id}/deactivations`、`GET /capability-packs`（可按状态过滤）；契约新增 3 个 Schema 与 3 个端点（257 schemas / 265 outputs / 228 operations）。

## 未关闭风险

- G01 仅完成能力包；继承环检测、可视化配置与沙箱/灰度发布未实现，G01 保持 `IN_PROGRESS`。
