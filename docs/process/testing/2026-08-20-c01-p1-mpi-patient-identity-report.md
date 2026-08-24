# C01-P1 患者主索引、双人合并与可逆撤销测试报告

日期：2026-08-20  
阶段：S007 `REPLAN` + S008 实施 + S009 `IMPLEMENT/EXECUTE/REPORT`  
结论：`LOCAL_VERIFIED`；真实医院患者主索引数据迁移、跨院标识规则和远程 CI 尚未联调。

## 1. 验收范围

| test_id | 风险/需求 | 预期 | 证据 |
|---|---|---|---|
| MPI-001 | 相似患者被直接自动合并 | 算法只创建带可解释信号的候选，任何分数都不自动合并 | `PatientIdentityWorkflowApiTest` |
| MPI-002 | 重复注册产生第二个活动患者 | 活动注册遇到候选时 409；可选择待核验身份，且生成开放候选 | `ClinicalLifecycleApiTest` |
| MPI-003 | 网络重试重复建档 | 相同幂等键与请求返回原患者；同键异请求冲突 | `ClinicalLifecycleService` + 集成断言 |
| MPI-004 | 人口学纠错覆盖历史 | 新增不可变版本，旧版本更新/删除由数据库触发器阻断 | V29 + 集成断言 |
| MPI-005 | 合并申请人自批 | 必须由另一位有效 MPI 管理员审批 | 自批 409 与独立审批 200 |
| MPI-006 | 合并搬迁或丢失就诊/文书 | 只写规范患者映射；患者 ID、标识符和临床外键不改写 | 合并前后 encounter.patient_id 保持源患者 |
| MPI-007 | 错误合并不可恢复 | 撤销也需申请人与审批人分离，并准确恢复源患者合并前状态 | `REVERSAL_PENDING → REVERSED` 集成断言 |
| MPI-008 | 跨租户或普通医生管理 MPI | 仅租户内有效系统/临床/病案/登记管理员可操作 | 普通临床角色 403 |
| UI-001 | 患者路由仍是静态占位 | 患者主索引和合并撤销页调用真实 API，未实现能力不伪造 | Vue 构建 + 194 路由浏览器审计 |

## 2. 实现证据

- V29 扩展患者身份状态，建立不可变 `patient_demographic_version`、候选队列 `patient_match_candidate` 和双人流程 `patient_merge_case`；合并案固化源患者合并前状态。
- 新注册支持 `ACTIVE` 与 `PENDING_VERIFICATION`；同姓名规范值、出生日期和性别的活动注册必须先确认候选，待核身份自动进入复核队列。
- 候选使用固定 `MPI-RULES-1` 信号：姓名规范值、出生日期、性别和共享标识符；患者对按 PostgreSQL UUID 顺序规范化，重复检测可安全更新。
- 合并只更新源患者的 `status/merged_into_patient_id`，不批量重写 encounter、document、order、result 或 identifier 外键；撤销清除规范映射并恢复原状态。
- 人口学纠错采用患者行版本乐观锁，并写入指向前版的不可变历史；所有命令带幂等记录、哈希审计链和 Outbox。
- `#/patient-registry` 已接候选检测、证据队列、身份核验、人口学纠错和版本历史；`#/patient-merge` 已接冲突处置、第二人审批、撤销申请和第二人撤销审批。

## 3. 实际执行

```text
scripts/verify.sh: PASS
Java: 28 suites / 71 tests / 0 failure / 0 skipped
Web: 4 files / 13 tests; Vue production build PASS; no React PASS
Contract: 3/3; 107 schemas / 115 generated outputs / 86 operations
Database: V1-V29 transaction migration + isolated restore fingerprint PASS
Physical field dictionary: 854 fields
AI eval: 100/100; security red-team: 15 payloads / 12 surfaces
Traceability: 138/138; route design map: 194/194
Browser: 194/194, zero route/console/HTTP/overflow failures; unknown route fail-closed
```

## 4. 兼容、回滚与未关闭风险

- V29 是纯前向增加式迁移；人口学历史不允许物理删除。应用回滚不能删除已产生的身份、合并案、审计或 Outbox 事实。
- 撤销恢复规范映射，不“反向搬迁”临床事实，因为合并从未搬迁事实；查询侧必须在 C01-T1 使用别名集合联合时间线。
- 当前匹配规则是确定性首版，尚未实现拼音/曾用名/证件 OCR、地址电话标准化、跨机构 assigning authority 治理及机器学习概率模型；新增信号必须版本化并经过偏差评估。
- 尚未使用真实医院历史主索引数据执行批量迁移、百万人级候选性能和人工病案科验收；因此结论仅为本机合成纵切通过，不等于真实医院上线批准。
