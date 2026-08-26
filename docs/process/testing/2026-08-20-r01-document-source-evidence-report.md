# R01-T2 病历附件与来源证据验证报告

> 日期：2026-08-20  
> 范围：FR-011/012/016/018/060，病历字段级来源、附件、质控和签署一致性  
> 结论：`LOCAL_VERIFIED`；R01 总任务仍为 `IN_PROGRESS`

## 交付结果

- V31 建立不可变 `clinical_document_attachment` 和 `clinical_document_source_reference`，附件和来源引用均固定到病历精确版本、患者、就诊和目标字段。
- 诊断、医嘱、结果与附件都记录捕获时版本；读取时重新解析当前权威版本，明确返回 `CURRENT`、`STALE` 或 `MISSING`，不静默沿用旧事实。
- 确定性质控固化文书内容哈希与来源水印；任一来源新增、变更或缺失都会使原质控证据失效，签署返回 `QUALITY_SOURCE_CHECK_REQUIRED`。
- 上传执行 25 MiB 上限、安全文件名、SHA-256、声明 MIME 与文件特征一致性、EICAR 恶意内容拒绝；开发环境使用原子本地对象存储，非开发环境未配置真实适配器时以 503 失败关闭。
- V32 将旧基线中 PostgreSQL 可接受但不满足 RFC UUID 位规则的模板/版本 UUID 映射为标准 UUID，并完整回连历史文书，不扩大到业务数据重写。
- `#/record-sources` 为原生 Vue 页面，展示附件数、引用数、过期/缺失、文书状态、来源版本链、不可变附件对象，以及草稿作者可用的附件和来源操作。
- 重复读取来源页曾触发固定 Outbox `aggregate_version=1` 冲突；现按租户锁内的聚合事件序号递增，并新增重复读取回归。患者时间轴测试也改为不受长期累积数据的 100 条分页上限干扰。

## 关键验证

| 门禁 | 结果 |
|---|---|
| `DocumentEvidenceApiTest` | PASS：有效上传、MIME/哈希/EICAR 拒绝、附件不可变、医嘱来源、来源水印、源版本过期、重复读取和签署阻断 |
| `PatientTimelineApiTest` | PASS：合并前别名、六源聚合、分页/过滤、部分源失败和逐条授权回归 |
| `scripts/verify.sh` | PASS：120 schemas / 128 outputs / 95 operations，100 AI eval，15 安全载荷，V1–V32 迁移与隔离恢复，31 suites / 76 Java tests，Web 13 tests，Vue 构建、安全扫描和 194/194 路由制品审计 |
| 视觉与响应式 | PASS：1051px 桌面和 768px 窄屏均无横向溢出；壳层在 820px 下切换为顶部横向导航，AI医助小南收为 44px 浮动入口；证据见 `docs/process/testing/design-audit/2026-08-20-r01-sources/` |

## 未扩大声明

- 生产对象存储、对象锁/WORM、真实杀毒引擎和医院 DICOM/PACS 上传联调仍未实现；当前开发存储和 EICAR 检查不代表生产安全验收。
- 合成演示当前文书为已签署状态，因此页面正确保持只读；写入成功/失败链由真实 HTTP 集成测试覆盖，尚未以真实医院账号完成浏览器人工验收。
- 本切片不包含 R01-T3 自动暂存/离线恢复、R01-T4 更正/撤销或 R01-T5 四角色浏览器 E2E。
