# C01 FR-006 就诊完整状态机测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`  
范围：FR-006 / AC-006 / C01 收口

## 结论

就诊从「创建即 `IN_PROGRESS`」升级为数据库强约束的完整状态机：`PLANNED → ARRIVED → IN_PROGRESS ⇄ SUSPENDED → FINISHED`，以及从 `PLANNED/ARRIVED/SUSPENDED` 到 `CANCELLED` 的合法终态。每次状态变化都在同一事务内追加不可变 `encounter_state_event` 证据链，并记录操作者、原因与发生时间；住院出院等既有流程通过同一历史链收口，不再另建一套门诊专用状态。

新增 API：`GET /patients/{patient_id}/encounters`、`GET /encounters/{encounter_id}/state-events`、`POST /encounters/{encounter_id}/state-transitions`，创建接口新增 `initial_status`、`department_id`、`responsible_user_id` 可选项。

这一结论只适用于本机合成数据。真实医院 IdP/JWK、跨院数据域与规模性能未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| ES-001 | 完整正向链 PLANNED→ARRIVED→IN_PROGRESS→SUSPENDED→IN_PROGRESS→FINISHED | 每步版本 +1，证据链 6 条且 from/to/version_no 精确 | `EncounterStateMachineApiTest.givenPlannedCreation_…` |
| ES-002 | 非法迁移（PLANNED→IN_PROGRESS、IN_PROGRESS→ARRIVED、FINISHED→IN_PROGRESS） | 拒绝且无副作用 | `givenIllegalTransition_…`，code=`INVALID_ENCOUNTER_TRANSITION` |
| ES-003 | 旧 expected_row_version | 拒绝 | `givenStaleExpectedVersion_…`，code=`VERSION_CONFLICT` |
| ES-004 | SUSPENDED/CANCELLED 缺原因 | 拒绝 | `givenSuspendOrCancelWithoutReason_…`，code=`ENCOUNTER_TRANSITION_REASON_REQUIRED` |
| ES-005 | 终态时间 | FINISHED/CANCELLED 必须同事务写 ended_at，非终态清空 | `givenTerminalState_…` + DB `encounter_terminal_time_check` |
| ES-006 | 状态事件不可变 | UPDATE/DELETE 被数据库触发器拒绝 | `givenTerminalState_…`（P0001 触发器） |
| ES-007 | 默认创建 | 未给 initial_status 时为 IN_PROGRESS，且追加 1 条创建证据 | `givenNoInitialStatus_…` |
| ES-008 | 就诊清单/详情 | 列表与详情返回当前状态、科室、责任医师 | `givenPatientEncounterListing_…` |

## 自动化门禁

```text
Java: 32 suites / 85 tests / 0 failure
Web: 5 files / 17 tests / 0 failure
Contracts: 144 schemas / 152 generated outputs / 117 operations
Database: V1-V37 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批修复

- 新增 `V37__encounter_state_machine.sql`：`department_id`/`responsible_user_id` 列、`encounter_state_event` 表、状态机守卫、证据追加与不可变三组触发器、终态时间约束，并对既有 FINISHED/CANCELLED 就诊回填 `ended_at`。
- 新增 `src/test/resources/schema/assert-v37.sql` 并接入 `scripts/test-schema.sh`，迁移契约推进至 V37。
- 契约生成器 `contracts/generate.mjs` 修复：可空枚举字段生成 Zod codec 时不再把 `null` 塞进 `z.enum([...])`，改为 `.nullable()` 处理，消除 `vue-tsc` 编译错误。
- `scripts/security-scan.sh` 增加无 ripgrep 主机上的 `find + grep` 便携回退，避免扫描工具缺失时静默 PASS；本机实测回退路径能检出伪密钥且全树无真实秘密。
- 修正 `PatientTimelineApiTest` / `PatientIdentityWorkflowApiTest` 两处直接 SQL 夹具：FINISHED 就诊补 `ended_at`，清理时先删状态事件（临时禁用不可变触发器）再删就诊。

## 未关闭风险

- 状态机在单租户合成规模下通过，未做跨机构、跨院区和百万级事件的 p95 性能验收。
- 真实医院 IdP/JWK、CA/可信时间戳与外部 SIEM/通知通道仍未联调，紧急访问与撤权在真实身份下的行为不构成本批结论。
- 就诊状态机只覆盖状态/时间/操作者证据，尚未纳入转科、转床、会诊等业务事件与状态的历史相关性建模，仍属后续 I01/W01 范围。
