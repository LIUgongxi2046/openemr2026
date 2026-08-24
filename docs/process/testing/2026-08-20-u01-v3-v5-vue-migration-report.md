# U01-V3–V5 Vue 单栈迁移与全路由门禁报告

日期：2026-08-20  
范围：既有 Backlog `U01-V3`、`U01-V4`、`U01-V5`  
结论：`LOCAL_VERIFIED`；远端 CI 首次执行待仓库接入后确认。

## 1. 结果摘要

- 生产前端使用 Vue 3、Vue Router、Pinia 和 TanStack Vue Query 单栈。
- 194/194 目标路由由唯一生成 registry 注册。
- 14 个已实现纵向路由为原生 Vue，并连接真实 `dev-synthetic` API。
- 71 个专科路由读取真实机构支持评估并默认拒绝未验证能力。
- 其余 109 个规划路由显示 `NOT_AVAILABLE`，未知深链不保留患者上下文。
- React 源码、依赖、类型、Vite 插件、legacy 适配层和生产 bundle runtime 均已移除。

## 2. 原生 Vue 纵向路由

`outpatient`、`opd-record`、`record`、`record-qc`、`record-sign`、`inpatient`、`record-versions`、`record-diff`、`archive-assets`、`opd-orders`、`ip-orders`、`opd-diagnosis`、`clinical-tasks`、`opd-results`。

U01-V3 新迁移范围保留原后端事实和安全语义：

- 住院：住院/床位/规则/文书任务、病程、临床事件、出院门禁和退回。
- 诊断：新增、确认、更正、停用均为追加式行为。
- 医嘱：门住院上下文分离，用药硬规则、签署、执行、停止和取消。
- 结果：结果录入、追加式更正、危急值接收与处置分离；读取结果与来源医嘱时分别申请对应 purpose 的 ContextLease，禁止跨目的复用租约。
- 统一任务：领域/风险/状态过滤、领取与协作入口。
- 病历证据：版本链、服务端 diff、病案就绪度和归档阻断。

## 3. 专科与未实现能力边界

`specialty-center` 及 10 个专科的 70 个深页，共 71 条路由，读取机构级支持评估。未声明、`PACK_PENDING`、`UNSUPPORTED` 和证据过期均失败关闭；即使达到 `BASIC_CLOSED_LOOP`，如果业务 API、异常恢复和临床验收未完成，也不伪装成可提交业务页面。

其余 109 条规划路由统一显示 `NOT_AVAILABLE`。这表示导航和边界已建立，不表示对应 FR 已实现。

## 4. 自动化证据

### 前端与 React 退场

- Vitest：4 个文件、13 个测试通过。
- `vue-tsc -b` 与 Vite production build 通过。
- `check:no-react` 阻断 React 包、React import、`.tsx` 和 `.jsx`。
- `npm ls react react-dom @vitejs/plugin-react --all` 无匹配依赖。
- 生产 bundle 无 React runtime 或 React 独立 chunk。

旧 React 静态标记测试随组件删除，前端单元测试由 37 降至 13。现有风险由 Vue 路由/codec/专科支持单测、Java 集成测试和浏览器审计覆盖；更细的 Vue 交互、a11y 与临床流程 E2E 继续纳入 S009。

### Chromium 全路由审计

`web/scripts/verify-browser-routes.mjs` 在 1440×1000 视口检查：

- 每条路由存在 H1。
- 恰有一个一级导航项带 `aria-current`。
- 页面无横向溢出。
- 控制台和 page error 为零。
- 失败 HTTP 响应为零。
- 未知路由失败关闭且不显示合成患者上下文。

审计在每条路由切换前等待 API 请求收敛，避免把上一页迟到请求误归到下一页；任一结构失败、控制台问题或失败 HTTP 响应都会返回非零退出码。

本机报告 `artifacts/playwright-ci/route-audit.json`：194 条、验证 194 条、0 failure、0 console issue、0 failed response、`unknownSafe=true`。

Playwright 固定为 `1.61.1`，原因是当前 macOS 13 环境不受 `1.62.1` Chromium 支持；CI 在 Ubuntu 24.04 使用同一 lockfile 版本并安装 Chromium。

### 根门禁

`scripts/verify.sh` 通过：

- 契约测试 3/3，91 个生成输出无漂移。
- V1–V22 数据库迁移与恢复指纹通过。
- Java 35 个测试通过。
- AI eval 100%，安全 payload/surface 检查通过。
- 前端 4 文件/13 测试、无 React 检查和 Vue production build 通过。
- 可追踪矩阵 138/138、生产路由映射 194/194。

## 5. CI 与剩余门禁

`.github/workflows/ci.yml` 已在根验证后启动 `dev-synthetic` 后端和 Vue dev server，执行 194 路由 Chromium 审计并上传证据目录。

当前目录没有可用的 Git 远端执行记录，因此只能标为 `LOCAL_VERIFIED`。远端 CI 首次成功、真实 OIDC/CA/KMS、完整业务路由、临床评审和 S010 发布安全门禁仍未完成，不能据此宣称真实医院生产就绪。
