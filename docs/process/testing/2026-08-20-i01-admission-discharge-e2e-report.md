# I01 新入院到成功出院浏览器 E2E 报告

> 日期：2026-08-20  
> 结论：`LOCAL_VERIFIED`；I01 完整医生站范围收口。

## 1. 新增纵向切片

- OpenAPI 新增 `GET /inpatient/bed-board?ward_id=...`，返回床位启停、占用状态和在院患者最小必要摘要。
- `#/admission-bed` 接入真实床位、病区工作清单和患者搜索 API，支持选择空床、选择候选患者、创建住院就诊、确认入院，以及点击已占床患者进入明确住院上下文。
- 合成病区新增 03 空床；床位 02 保留活动住院患者，用于同时验证占床与空床两种事实。
- 全局 AI医助小南固定在顶部导航；桌面为 95×36 胶囊，390px 为 36×36 圆标，不遮挡入院动作。

## 2. 授权与恢复语义

- 患者搜索先签发无患者范围的 `PATIENT_SEARCH` ContextLease，并提交契约要求的 `purpose_code`。
- 创建 `INPATIENT` 就诊前签发患者范围 `INPATIENT_ADMISSION` 租约；正式入院再签发患者与就诊范围租约。
- 入院若在住院就诊创建后失败，页面保留待办理 encounter id，重试不会重复创建住院就诊。
- 活动占床唯一约束保护并发抢床；床位释放、出院事实、审计事件和 Outbox 在同一事务提交。

## 3. 真实浏览器剧本

1. 打开 `#/admission-bed`，服务端返回 2 床、1 空床、1 名当前在院患者。
2. 检索“合成患者甲”，只返回最小患者摘要；选择 03 空床。
3. 创建新的 `INPATIENT` 就诊并确认入院，自动进入 `#/inpatient-overview`。
4. 总览显示 `ADMITTED`、合成心内科病区 03 床，并自动生成首次病程、入院记录、主治首次查房 3 项任务。
5. 进入 `#/inpatient-discharge`，填写诊断；对本次合成 E2E 未完成文书填写显式豁免理由。
6. 服务端通过岗位与任务门禁，状态变为 `DISCHARGED`；页面确认床位、审计与 Outbox 同事务提交。
7. 返回床位页，03 床重新显示“可入床”；点击 02 床恢复长期合成住院患者演示上下文。

既有测试同时覆盖无豁免时 `DISCHARGE_TASKS_OPEN` 失败关闭，因此成功链没有削弱默认文书阻断。

## 4. 门禁结果

- Contracts：`142 schemas / 150 outputs / 113 operations`，生成漂移检查通过。
- Backend：`InpatientAdmissionApiTest` 6/6，通过空床→占床查询及入院/出院事务断言。
- Web：5 files / 17 tests；Vue/TypeScript 生产构建 235 modules。
- Browser：1051×1000 与 390×844；`scrollWidth === innerWidth`；AI 顶部入口尺寸分别为 95×36 与 36×36；控制台无 error/warning，仅 Vite debug。
- Full regression：根 `scripts/verify.sh` 全绿，覆盖 31 suites / 77 Java tests、V1–V36 全量迁移与隔离恢复、100 AI eval、15 安全载荷、Web 测试/构建及治理追踪；随后真实 Chromium 194/194 路由通过，零结构失败、零控制台问题、零失败 HTTP 响应，未知深链失败关闭。

## 5. 明确不扩张的范围

- 本报告关闭 I01 医生站与住院病历闭环，不代表 N01 护理执行、床旁给药和交班完成。
- 当前使用本机 PostgreSQL、合成身份和合成数据；医院 OIDC、真实 CA、对象存储和外部集成仍受各自发布门禁约束。
