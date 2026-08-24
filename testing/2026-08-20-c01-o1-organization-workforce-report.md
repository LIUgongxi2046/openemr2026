# C01-O1 组织有效期与人员/账户分离测试报告

日期：2026-08-20  
阶段：S008 实施 + S009 `IMPLEMENT/EXECUTE/REPORT`  
结论：`LOCAL_VERIFIED`；真实医院组织数据、统一身份平台人员同步与远程 CI 尚未联调。

## 1. 验收范围

| test_id | 风险/需求 | 预期 | 证据 |
|---|---|---|---|
| ORG-001 | 机构→院区→科室→病区→床位层级 | 有效期、版本号和父子关系可验证 | V23/V24 schema 断言 + API 测试 |
| ORG-002 | 组织/科室循环 | 数据库触发器拒绝 | `OrganizationWorkforceSchemaTest` |
| ORG-003 | 带活动子节点停用 | 拒绝；叶子节点按版本停用 | `OrganizationAdministrationApiTest` |
| ID-101 | 自然人与账户混同 | person/account/role/workforce/credential 独立建模 | V23/V24 + `WorkforceAdministrationApiTest` |
| ID-102 | 账户停用后租约仍可使用 | 上下文租约立即失效 | API 测试返回 403 |
| ID-103 | 角色结束与工作范围漂移 | 同步为 `ENDED` | 角色同步触发器 + API 测试 |
| LEGAL-101 | 人员改名覆盖历史签名/审核人 | 保留签署时姓名快照 | name history + 不可变触发器 |
| SEC-101 | 非管理员调用后台 API | 失败关闭 403 | 组织/人员 API 测试 |

## 2. 实现证据

- V23 建立组织、科室、病区、床位有效期层级，新增 `workforce_person` / `workforce_assignment` / `practitioner_credential`，并前向回填现有账户与角色。
- V24 增加账户版本、人员姓名历史、签名人/审核人法律证据快照。
- V25 将签名和审核快照的不可变保护拆为表专用触发器，修复全量回归发现的跨表 `NEW` 字段解析错误。
- OIDC 映射、ContextLease 签发和临床命令重验证均要求活动人员、活动账户、有效角色与工作范围。
- 新增 6 组组织/人员管理 OpenAPI 操作，命令统一使用幂等键、乐观版本、审计链和 Outbox。
- `#/admin-org` 与 `#/admin-users` 已从占位路由转为 Vue 3 原生页面，直接使用组织和人员 API。

## 3. 实际执行

```text
scripts/verify.sh: PASS
Java: 25 suites / 66 tests / 0 failure / 0 skipped
Web: 4 files / 13 tests; production build PASS; no React PASS
Contract: 3/3; 90 schemas / 98 generated outputs / 69 operations
Database: V1-V25 transaction migration + isolated restore fingerprint PASS
Physical field dictionary: 750 fields
AI eval: 100/100; security red-team: 15 payloads / 12 surfaces
Traceability: 138/138; route design map: 194/194
Browser: 194/194, zero console/HTTP/overflow failures
```

## 4. 兼容、回滚与未关闭风险

- 迁移只做前向扩展和回填，保留现有 `app_user` / `role_assignment` 主键与复合外键；旧插入路径由兼容触发器生成 person/workforce 关联。
- 数据库发行后不删除人员或历史签名证据，只能使用新的前向修正迁移。UI 可按路由回退为 `NOT_AVAILABLE`，API/数据不回退。
- 尚未运行真实医院 HR/IAM 全量人员同步、批量调岗/离岗、医师执业信息外部核验和远程 CI，因此仅标记 `LOCAL_VERIFIED`。
- ABAC、患者关系与紧急访问属于下一施工单 `C01-A1`。
