# R01-T5 住院四角色审签 E2E 验证报告

> 日期：2026-08-20  
> 结论：`LOCAL_VERIFIED`；R01-T1–T5 的本机验收已收口，真实 CA、医院身份平台和远程 CI 仍是发布前外部证据。

## 1. 交付范围

- `#/inpatient-doc-editor`、`#/inpatient-doc-qc` 使用真实住院任务、文书、质控、治理和签署 API，不再落入 `NOT_AVAILABLE`。
- 文书只能从规则化住院任务创建；编辑器按模板字段动态渲染，保存产生不可变新版本。
- 确定性质控 `BLOCKED` 禁止签署；`WARNING` 必须记录人工处置意见；退回后必须重写新版本并重新质控。
- 严格执行 `AUTHOR → ATTENDING → CHIEF → MEDICAL_RECORDS`，要求不同岗位、不同人员按序签署，最终正文只读。
- 开发环境提供四个合成岗位用于复现；生产构建不包含合成身份、令牌和患者标识。

## 2. 浏览器证据

合成任务 `SYNTHETIC.FOUR_LEVEL_REVIEW` 完成以下真实 API 链路：作者创建并保存 v2、运行质控得到 `WARNING/0 blocking`、记录处置并签署；主治、科主任和病案人员依次切换岗位租约并签署。最终文书为 `v2 / SIGNED`，住院任务为完成态，四份非撤销签名证据均绑定内容哈希 `5c8ec321e41eb417…`，CA 未接入时状态如实保持 `PENDING_CA_EVIDENCE`。

桌面与 390px 视口检查覆盖角色切换、患者条、四步进度、双列结构化正文、质控动作区、签名时间轴、完成态只读和全局 AI 入口；控制台 `0 error / 0 warning`。视觉结论见 `testing/design-audit/2026-08-20-r01-inpatient-four-role/audit.md`。

## 3. 自动化与全量门禁

| 门禁 | 结果 |
|---|---|
| `InpatientAdmissionApiTest` | PASS；覆盖主治退回、作者新版本重写、作者/主治/主任/病案四人签署及人员分离 |
| 契约生成/漂移 | PASS；126 schemas / 134 outputs / 99 operations |
| AI / 安全数据集 | PASS；100 / 15 |
| 数据库 | PASS；V1–V33 迁移、隔离备份恢复和指纹一致性 |
| 后端 | PASS；31 suites / 76 Java tests |
| 前端 | PASS；17 tests、Vue typecheck、227 modules production build |
| 安全扫描 | PASS；生产包无开发身份、合成患者和凭据材料 |
| 需求与路由 | PASS；138/138 FR 追踪，194/194 路由制品审计 |

首次全量门禁正确阻断了顶层四角色常量进入生产包的问题。修复为 `import.meta.env.DEV` 分支整体裁剪后，独立安全扫描和第二次全量 `scripts/verify.sh` 均通过。

## 4. 保留边界

- `PENDING_CA_EVIDENCE` 不是有效 CA 证书；真实 CA/时间戳服务未接入前不得宣称电子签名生产验收完成。
- 开发身份切换只用于合成验收；生产必须由 OIDC 主体、岗位任期、病区范围和人员分离策略决定。
- 本切片关闭 R01 的住院四级审签任务，不代表护理、住院医嘱执行、LIS/PACS、收费和全部住院深页已经完成。
