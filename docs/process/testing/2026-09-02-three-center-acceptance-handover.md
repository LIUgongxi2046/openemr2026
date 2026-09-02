# 三大中心验收交接文档（未完成任务盘点）

- 日期：2026-09-02
- 范围：全院病历中心、病案资产中心、医疗质量中心（不含其他模块）
- 数据来源：Codex 会话转录（`~/.codex/sessions/2026/08-30` 起）、仓库内验收报告、当前 git 工作区状态
- 结论摘要：三个中心均已完成 **Design QA（视觉/交互还原）验收 PASS**；其中**医疗质量中心**与**病案资产中心**已产出生产化整改/升级报告，**全院病历中心尚未产出生产化验收报告**。三者代码**均未提交**（质量中心已暂存，另两个未暂存 + 有未跟踪新文件）。外部系统（直报网关、CA/TSA、ClamAV/OCR/CDA、S3 Object Lock、真实 IdP、真实大模型等）三类阻断项均未联调，投产门禁保持 **NO_GO**。

---

## 1. 三中心总览对照

| 维度 | 医疗质量中心 | 病案资产中心 | 全院病历中心 |
| --- | --- | --- | --- |
| 二级菜单 | 质量总览 / 院科质控 / 评级取证 / 院感事件 / 临床资质 | 总览 / 病案目录 / 扫描编目 / 完整性与验真 / 借阅复制 / 长期保存 | 病历工作台 / 专注编辑 / 来源证据 / 质控审签 / 版本证据 / LIS 报告 / PACS 影像 |
| Design QA | ✅ PASS（`design-qa.md`） | ✅ PASS（`design-qa.md`） | ✅ PASS（`design-qa.md`） |
| 生产化整改报告 | ✅ `2026-09-01-quality-center-production-remediation-report.md` | ✅ `2026-09-01-archive-asset-production-upgrade-report.md` | ❌ 缺失 |
| 端到端写回归 | ✅ PASS（96 次写入，0 发现） | ✅ PASS（24/24，0 发现） | ✅ PASS（34/34，0 发现；2026-09-02 补跑） |
| git 状态 | 已暂存（staged），未提交 | 未暂存 + 未跟踪，未提交 | 未暂存 + 未跟踪，未提交 |
| 外部集成阻断 | 6 类未联调 | 7 类未联调 | 未书面盘点 |

---

## 2. 医疗质量中心

### 2.1 已完成
- 二至七级业务闭环：二级五个主题入口，三级/四级真实列表与详情，五级整改、六级证据、七级复核均支持新建/编辑/逻辑作废，写操作使用弹窗。
- 后端真实数据聚合替代固定伪指标；写入具备幂等键、乐观锁、逻辑作废、审计哈希链与事务性 outbox。
- 中国医疗适配：院感事件（感染病例/暴发/法定传染病、2h/24h 报送时限、直报状态、报告卡号/回执号/更正关系）、临床资质（执业范围、处方权、抗菌药物/麻精/手术级别、高风险权限限定医师）。
- Agent 边界：只生成带证据水印的候选建议，必须人工复核，确定性规则可回归。
- 修复身份异步竞态、入口包 552KB→275.79KB、安全扫描 4/4 通过。

### 2.2 未完成（外部阻断，来自报告 §3）
1. 国家传染病/院感直报网关未对接（仅完成结构化数据、时限算法、待报队列、回执/更正模型）。
2. 真实医院 OIDC/统一身份、MFA、人员离职与执业权限实时吊销未联调。
3. CA 电子签名、可信时间戳、证书吊销列表、KMS/HSM、数据库及备份加密未验收。
4. HIS/EMPI、LIS、PACS、手麻、病理、院感和评级上报等真实接口未逐院映射联调。
5. 真实模型供应商、院内知识库、模型评测、伦理/信息审批、人工治理值守未接入。
6. 分布式限流、基础设施扫描、渗透测试、容灾演练、生产部署验证未执行。

### 2.3 代码状态（未提交）
- **已暂存**：`quality/QualityGovernance*`（Controller/Service/Exception/Handler）、`InfectionEventService`、`CredentialAdministration*`、迁移 `V324__quality_governance_depth.sql`、`V341__infection_cn_reporting.sql`、前端 `quality-governance.ts`、`QualityGovernanceDepthPage.vue` 等 37 个文件。
- 曾尝试在主仓库 commit，因 `.git` 只读改为临时副本提交，提交号为 `495a8c5`，导出补丁 `quality-center-final-commit.patch`（当前仍为未跟踪文件，未落库）。

### 2.4 下一步
- 将已暂存改动落成一个独立 commit（或 `git am < quality-center-final-commit.patch`）。

---

## 3. 病案资产中心

### 3.1 已完成
- 原始文件上传/读回、SHA-256、恶意文件扫描、服务端 OCR 与 CDA 结论派生（拒绝用户伪造 VERIFIED/FAILED）。
- 验真与流程硬门：存储重读复算哈希；验真失败/原件缺失/已作废真实阻断借阅、复制与 WORM 封包。
- 借阅（新建/更期/归还）、复制包与用途清单不可变哈希、交付台账；长期保存（保留年限排期、封包、对象锁、抽样恢复）。
- L5–L7 质量治理与 Agent 候选建议（新建/编辑/逻辑作废/版本并发/审计 Outbox）。
- 中国医疗适配：门急诊 15 年/住院 30 年保存年限、跨 tenant/org/facility/patient fail-closed、病案岗位权限、患者复制主体区分、逻辑作废语义、原件原则。
- 修复 08-31 报告的 P1 浏览器脚本延迟 Promise 问题；24/24 端到端写回归 0 发现。

### 3.2 未完成（外部集成阻断，来自报告 §6）
1. 扫描仪/高拍仪：仅支持受控文件上传，无 TWAIN/ISIS/院内采集网关。
2. ClamAV：生产 INSTREAM 适配器已实现，本轮用合成 EICAR 扫描器。
3. OCR：调用链已实现，本轮用合成引擎。
4. CDA：HTTPS 适配器已实现，本轮用安全合成解析器。
5. S3/Object Lock/WORM：生产 SigV4 + Object Lock COMPLIANCE 代码已实现，本轮 `FILESYSTEM_DEV` 仅本地建议锁。
6. 复制实际交付：台账真实可用，安全门户/加密介质实际传输未实现。
7. 电子签章/CA/TSA、备份与离线副本未验收。

### 3.3 代码状态（未提交）
- **未暂存（modified）**：`ArchiveObjectStorage`、`FileSystemArchiveObjectStorage`、`MedicalRecordAssetController/Service`、`ArchiveAssetEditorDialog.vue`、6 个 Archive 页面、`MedicalRecordAssetApiTest`、`verify-archive-asset-write-regression.mjs`。
- **未跟踪（new）**：`ArchiveDocumentValidator`、`ArchiveMalwareScanner`、`ClamAvArchiveMalwareScanner`、`ConfigurableArchiveDocumentValidator`、`S3ArchiveObjectStorage`、`SyntheticArchiveDocumentValidator`、`SyntheticArchiveMalwareScanner`、迁移 `V326__archive_asset_governance_depth.sql`。
- 报告本身 `2026-09-01-archive-asset-production-upgrade-report.md` 也是未跟踪文件。

### 3.4 下一步
- 将病案资产中心的 modified + new 文件整理成一个独立 commit。

---

## 4. 全院病历中心（最不完整，重点）

### 4.1 已完成
- 七个二级页面（病历工作台/专注编辑/来源证据/质控审签/版本证据/LIS 报告/PACS 影像）的视觉、路由与核心交互还原，Design QA PASS。
- 二级导航栏按要求改名为「全院病历中心」并移至顶部；版本/签名/来源证据采用追加、更正、撤签、作废语义。
- 后端出现了一批未跟踪的新实现（见 4.3），说明「中国医疗适配 + 二~七级补全」在代码层面已动工。

### 4.2 未完成
1. **无生产化整改验收报告**：另两个中心都有 09-01 报告，本院病历中心没有，四点整改（demo 清理 / 中国医疗适配 / 二~七级补全 / 测试与安全问题修复）无书面收敛结论。
2. **端到端写入回归已跑通（2026-09-02 补跑）**：`verify-record-center-write-regression.mjs` 现为 **34/34 PASS、0 findings、exit 0**，连续两次运行稳定通过。覆盖病历创建/编辑/编辑保存/质控/来源证据（附件增替作废）/LIS 引用/影像执行/PACS 引用/来源更正与撤销/签署/批量验签/依法更正/更正签署/签名撤销/版本差异/病历作废。运行中修复了三个真实缺陷（见 4.4）。
3. **已知交互缺陷已修复并回归确认**：「来源证据」侧栏遮挡问题、批量验签并发死锁、撤销签名 VERSION_CONFLICT 竞态均已修复并通过回归。
4. **外部集成阻断项未盘点**：CA/可信时间戳/DICOMweb 像素服务等属于外部边界，尚未像另两个模块那样形成书面清单。

### 4.3 代码状态（未提交）
- **未暂存（modified）**：`RecordCenterPage.vue`（+356 行）、`RecordEditorPage.vue`、`RecordGovernancePage.vue`、`RecordVersionsPage.vue`、`LisReportPage.vue`、`PacsViewerPage.vue`、`ImagingWorkbenchPage.vue`、`records.ts`、`ClinicalLifecycleService`、`DocumentGovernanceService`、`ClinicalCommandExceptionHandler`、`ClinicalLifecycleApiTest`、`verify-record-center-write-regression.mjs`、`record-center-write-regression.json`。
- **未跟踪（new）**：`RecordCenterController/Exception/ExceptionHandler/Service`、`DocumentAuditTrailController/Service`、`DocumentSignatureVerificationController/Service`、`ClinicalSignatureProvider`、`CorrectionPropagationProvider`（含 `Synthetic*` / `FailClosed*` 实现）、迁移 `V330__record_center_worklist_and_review_case.sql`、`V340__document_signature_verification_run.sql`、前端 `record-center.ts`、`document-audit.ts`、`signature-verification.ts`、`RecordEvidenceDepthPage.vue`、测试 `RecordCenterServiceTest`、`ClinicalProviderFailClosedTest`。

### 4.4 本轮（2026-09-02）已完成的回归修复

在补跑病历中心端到端回归过程中，修复了三个真实缺陷并已由回归确认：

1. **批量验签并发死锁（后端阻塞，已修）**：`RecordVersionsPage.vue` 的 `verifyAllSignatures` 用 `Promise.all` 对每个版本并发发起验签，多个事务同时 `select tenant for update`（审计哈希链锁）导致 PostgreSQL deadlock → 500。改为顺序执行。
2. **撤销签名 VERSION_CONFLICT 竞态（已修）**：更正签署后异步更正传播会推进 `clinical_document.row_version`，`confirmRevocation` 用页面加载时的旧 `row_version` 发起撤销会被乐观锁 409 拒绝。改为撤销前 `reloadSelected()` 重取最新文档再撤销。
3. **测试脚本与页面文案/断言不同步（已修）**：`运行全量质控` 按钮已更名为 `运行确定性质控`；作废后的「已作废」状态是单元格内非精确文本，断言改为非精确匹配；并过滤了门诊预置页空 `encounter_id` 加载产生的良性 400。

### 4.5 下一步（优先）
1. 按四点整改口径补写 `2026-09-02-record-center-production-remediation-report.md`（含外部集成阻断清单）。
2. 将病历中心 modified + new 文件（含本轮两处前端修复）整理成一个独立 commit。

---

## 5. 跨模块未完成与提交计划

### 5.1 三中心全部未提交
当前分支 `main` 领先 `origin/main` 9 个提交，但三大中心的改动全部还在工作区（staged/unstaged/untracked），没有任何一个落库。

### 5.2 建议按模块拆分为 3 个 commit（避免互相污染）
1. `feat(quality-center): ...` —— 已暂存的 37 个质量中心文件。
2. `feat(archive-assets): ...` —— 病案资产的 modified + new 文件 + 报告 + `V326`。
3. `feat(record-center): ...` —— 病历中心的 modified + new 文件 + 迁移 `V330/V340`。

### 5.3 共享/跨模块文件（需在拆分时单独决策归属）
- `contracts/openapi.json`（同时出现在 staged 与 unstaged，说明暂存后又被改动）、`contracts/generated/*.json`、`web/src/generated/contracts.ts`、`web/src/vue/router.ts`（也同时在 staged/unstaged）、`web/src/styles.css`、`artifacts/test-runs/api-surface-audit.json`。
- `configuration/ProductionEnvironmentPostProcessor.java`（+ 测试）、`application.yml`、`application-prod.yml`。
- `V318__inpatient_pharmacy_order_traceability.sql`、`V321__inpatient_pharmacy_order_traceability.sql` 属**住院药房模块，不在三中心范围**，提交时应剥离或单独处理。
- 工作区散落的构建产物 `build-opd-*`、`build-outpatient-audit/` 不应进入三中心提交。

### 5.4 迁移版本注意
- `V342__medical_record_asset_facility_scope.sql` 是**兼容标记迁移**（注释说明：因开发库已记录 V327 身份与 checksum，故保留原 V327 身份），不是与 V327 重复，需按现状一并纳入病案资产中心提交，避免误判为重复迁移删除。

---

## 6. 建议执行顺序

1. **先收敛全院病历中心**（唯一缺报告、回归未完成的模块）：跑完端到端写回归 → 补写生产化整改报告 → 形成独立 commit。
2. **再落库医疗质量中心**（已暂存，最接近可提交）：直接 commit 或 `git am` 补丁。
3. **然后落库病案资产中心**（有报告、回归 PASS）：整理 modified + new 后 commit。
4. 三中心代码入库后，再按各报告的「外部集成阻断项」清单，选定一套真实外部系统（扫描采集网关、ClamAV、OCR、CDA、Object Lock S3、直报网关、IdP/CA）逐一联调，作为下一个可验收里程碑。
5. 全程保持「本地业务闭环 PASS ≠ 全院生产就绪」的口径，外部依赖未联调前投产门禁维持 NO_GO。
