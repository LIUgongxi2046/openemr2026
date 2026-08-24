# C01-T1 授权患者纵向时间线测试报告

日期：2026-08-20  
状态：`LOCAL_VERIFIED`  
范围：FR-007 / AC-007 / C01-T1

## 结论

患者时间线已从规划页切换为原生 Vue 生产纵向页，后端使用规范患者 ID 联合合并前别名档案，读取就诊、文书、诊断、医嘱、结果和任务。对外响应提供类型/时间/状态筛选、最多 100 条的不透明游标分页、数据水位和每源完整性。

这一结论只适用于本机合成数据。真实医院跨院数据域、历史级大数据量和并发性能未验证，不构成生产发布结论。

## 高风险验收

| 编号 | 场景 | 预期 | 证据 |
|---|---|---|---|
| TL-001 | 合并后查看规范患者 | 保留原临床外键，同时联合源/目标档案 | `PatientTimelineApiTest` 命中 180 天前的别名急诊就诊 |
| TL-002 | 六类数据源正常 | 全部 `AVAILABLE`，整体 `COMPLETE` | 集成测试断言六源无查询错误 |
| TL-003 | 结果与任务源失败 | 其他源继续返回，失败源显式 `PARTIAL/retryable` | 合成故障注入 |
| TL-004 | 发布的 ENCOUNTER/READ DENY | 不返回正文、资源 ID 或真实条数 | items 空、`loaded_count=0`，审计 `redacted_count>=1` |
| TL-005 | 租约患者与 Header 患者不一致 | 失败关闭，不回传别名资料 | HTTP 403，响应不含患者姓名/就诊 ID |
| TL-006 | 状态筛选、游标翻页和非法游标 | 筛选精确，翻页稳定，非法游标 400 | 两页连续读取和 `PATIENT_TIMELINE_REQUEST_INVALID` |
| TL-007 | 真实空数据与部分失败 | UI 文案不得混淆 | `#/patient-timeline` 独立源状态卡和不完整警示 |

## 自动化门禁

```text
Java: 29 suites / 74 tests / 0 failure
Web: 4 files / 13 tests / 0 failure
Contracts: 110 schemas / 118 generated outputs / 87 operations
Database: V1-V29 migration contract PASS; isolated backup/restore PASS
AI eval: 100/100 PASS
Security eval: 15 payloads / 12 surfaces PASS
Traceability: 138/138; route design map: 194/194
Browser: 194/194; 0 route failure; 0 console issue; 0 failed HTTP; unknown route fail-closed
```

## 未关闭风险

- 当前聚合查询在合成数据规模下通过，但未完成百万级历史事件的索引、分区和 p95 性能验收。
- 当前范围是同租户、同组织与同院区；跨医疗机构的患者授权交换不在本切片。
- 源系统级熔断、重试队列和可观测 SLO 需在真实 LIS/PACS/集成连接器实施时关闭。
