# R01-T4 病历依法更正、签名撤销与传播验证报告

> 日期：2026-08-20  
> 结论：`LOCAL_VERIFIED`；R01 总任务仍为 `IN_PROGRESS`

## 已交付能力

- V33 新增 `document_correction_case`、`document_signature_revocation`、`document_correction_propagation` 和 `document_correction_event`。签名撤销与更正事件禁止更新、删除；更正案件与传播任务只允许受控状态迁移。
- 只有当前源版本已签署且文书头为 `SIGNED/VOID` 时，才能以精确的 `source_document_version_id + expected_row_version` 创建 `CORRECTION/ADDENDUM` 草稿。新草稿复制源正文和签名策略，原已签版本、内容哈希和签名证据保持不变。
- 更正草稿继续复用统一质控与签名内核。完成最终签署后，同一事务把更正案转为 `SIGNED`、记录不可变事件，并建立 `EXTERNAL_SHARED_RECORD` 传播任务。
- 签名撤销要求原因、当前文书行版本和精确签名 ID；仅原签署人或有效 `MEDICAL_RECORDS/CLINICAL_ADMIN` 角色可执行。原签名状态转为 `REVOKED`，独立记录撤销人、原因和时间；撤销当前版本时文书头转 `VOID`，已签正文不被改写。
- 传播重试保存尝试次数、最后错误、时间和行版本。真实外部适配器未配置时返回并记录 `FAILED / ADAPTER_NOT_CONFIGURED`，不把投递请求误报为成功。
- `#/record-versions` 已接入真实更正、治理、签名与传播 API，形成文书选择、版本时间轴、证据摘要、依法更正表单、传播台账、签名证据和撤签二次确认。更正理由不足 4 字及撤签理由不足 4 字时提交保持禁用。

## 契约与接口

- `GET/POST /api/v1/documents/{document_id}/corrections`
- `POST /api/v1/documents/{document_id}/signature-revocations`
- `POST /api/v1/documents/{document_id}/correction-propagations/{propagation_id}/retry`
- OpenAPI 单一来源生成 6 个新增 wire schema/output，当前总计 126 schemas、134 outputs、99 operations；Java 与 TypeScript 生成物漂移检查通过。

## 自动化与真实链路

1. 在集成测试中创建并质控、签署 v2，保存原签名证据。
2. 基于 v2 创建更正草稿；断言源版本仍为 `SIGNED`，新草稿拥有独立版本与来源指针。
3. 对更正草稿重新执行质控并签署；断言更正案为 `SIGNED` 且自动产生 `PENDING` 传播任务。
4. 重试传播；断言任务为 `FAILED`、错误码为 `ADAPTER_NOT_CONFIGURED`、尝试次数为 1，未生成虚假送达时间。
5. 撤销原版本签名；断言签名状态为 `REVOKED` 且撤销证据完整。直接更新撤销证据被数据库不可变触发器拒绝。
6. 真实浏览器读取现有合成已签门诊病历，验证更正表单预填、原因门禁、签名证据和撤签确认；为保持演示病历稳定，浏览器未提交更正或撤签，写链路由集成测试覆盖。

## 门禁结果

| 门禁 | 结果 |
| --- | --- |
| 契约测试与漂移 | PASS：3 tests；126 schemas / 134 outputs / 99 operations |
| 后端集成测试 | PASS：31 suites / 76 tests；包含更正→质控→重签→传播失败→撤签→不可变攻击链 |
| 数据库 | PASS：V1–V33 事务迁移；隔离备份/恢复指纹一致 |
| AI / 安全 | PASS：100 AI eval；15 个安全载荷 / 12 个攻击面；生产秘密和合成身份扫描通过 |
| Web | PASS：5 files / 17 tests；Vue TypeScript 与生产构建通过；无 React 门禁通过 |
| 需求与路由 | PASS：138/138 FR/AC 追踪；194/194 路由制品审计 |
| 浏览器视觉 | PASS：默认 1050px 与 390px；表单、证据台账、移动布局和 44px AI 入口无阻断问题 |

## 边界与下一步

- 当前传播目标只有可取证任务和失败恢复内核，真实区域平台、病案共享、LIS/PACS/HIS 连接器尚未实现；接口联调前必须保持失败关闭。
- 当前 CA/时间戳只保留待证据状态，不伪造第三方有效结果；生产环境仍需完成受信 CA、签名验真、证书吊销和可信时间源联调。
- 浏览器没有对演示数据执行最终撤签；该破坏性状态变化已由真实 PostgreSQL 集成测试验证。
- R01-T5 住院 `AUTHOR → ATTENDING → CHIEF → MEDICAL_RECORDS` 四角色浏览器 E2E 尚未完成，因此 R01 和 V1.0 均不得标记完成。
