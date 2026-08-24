# N01 护理体征记录首切测试报告

日期：2026-08-21  
状态：`LOCAL_VERIFIED`（N01 整体仍 `IN_PROGRESS`）  
范围：FR-050 / N01 体征·出入量首切（生命体征记录）

## 结论

护理体征记录首切落地：`vital_sign_record` 记录体温/脉搏/呼吸/收缩压/舒张压/血氧，含生理范围数据库约束（体温 30–45℃、脉搏 20–300、呼吸 4–60、血压 40–300/20–200、SpO2 50–100、舒张压<收缩压）与不可变触发器；记录绑定「患者×就诊×院区」且要求就诊处于 `ARRIVED/IN_PROGRESS/SUSPENDED`，错患者/错上下文失败关闭；幂等键重放不重复记录。

这一结论只适用于本机合成数据。真实监护设备接入、出入量与移动床旁离线补录未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| VS-001 | 记录体征 | 落库并可按就诊列出，`recorded_by` 正确 | `NursingVitalSignsApiTest.givenActiveEncounter_…` |
| VS-002 | 越界体征 | 数据库约束拒绝 | `givenOutOfRangeVitalSign_…`（DataAccessException） |
| VS-003 | 幂等重放 | `IDEMPOTENCY_REPLAY` 不重复记录 | `givenReplayedKey_…` |
| VS-004 | 记录不可变 | UPDATE/DELETE 被触发器拒绝 | `givenVitalSignRecord_whenTampered_…` |

## 自动化门禁

```text
Java: 34 suites / 100 tests / 0 failure（+1 套件 +4 体征测试）
Web: 5 files / 17 tests / 0 failure
Contracts: 156 schemas / 164 generated outputs / 117 operations
Database: V1-V43 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Security scan: credential / bundle-identity / inline-secret / profile-isolation PASS
```

## 本批实现

- 新增 `V43__nursing_vital_signs.sql`：`vital_sign_record`（体征字段 + 生理范围约束 + 不可变触发器 + 就诊索引）。
- 新增 `NursingService`/`NursingController`/`NursingExceptionHandler`：`POST /vital-signs` 与 `GET /vital-signs`；契约新增 `VitalSignRecord`、`VitalSignRecordRequest`。

## 未关闭风险

- 目前仅生命体征（体温/脉搏/呼吸/血压/血氧），未含出入量（intake/output）、疼痛评分与血糖。
- 护理计划、护理记录、床旁五对核验、交接班、转区任务迁移与移动床旁离线草稿仍未实现，N01 保持 `IN_PROGRESS`。
- 未接真实监护设备（HL7/设备网关）与离线补录双时间戳。
