# U01-V1 Vue 3 壳层、单路由表与合约 Codec 测试报告

- 日期：2026-08-20
- 对应任务：`U01-V1`
- S008/S009 状态：`VERIFIED`（本地）；U01 总任务仍 `IN_PROGRESS`
- 数据边界：仅合成数据库与开发身份；无真实患者数据

## 1. 交付结果

- `web/src/main.ts` 是唯一生产入口；Vue 3.5.41、Vue Router 4.6.4、Pinia 3.0.4、TanStack Vue Query 5.101.4、Vite 8.2.1 已进入 lockfile。
- `route-design-map.csv` 与 traceability 经契约生成器输出 `web/src/generated/route-contract.ts`，194 个 route ID、主域、角色、守卫、状态和需求引用唯一注册。
- Vue 壳层统一品牌、一级导航、Logo 槽和全局 AI 入口。默认 Logo 是 `web/public/brand/default-logo.png`，可用 `VITE_BRAND_LOGO_URL` 替换。
- 13 个当前已实现纵切暂由 lazy React 叶适配器承载，旧 topbar/nav 从视觉和无障碍树隔离；没有第二个生产入口或第二套路由监听。其余路由显示安全 `NOT_AVAILABLE` 契约页，不伪造患者数据和可提交动作。
- 未知路由进入 Safe NotFound，并销毁 Vue 临床上下文；`#/record` 与 `#/opd-record` 一级归属可分离。
- 新增生成 AI event codec 的未知 schema 拒绝、sequence 去重/断档、错 lease/run 拒绝测试。
- 构建前扫描 React baseline，禁止新增 `.tsx` 业务页；生产包扫描增加合成患者名称和协作人员名称。

## 2. 自动验证

| 门禁 | 结果 |
|---|---|
| Contract test/check | PASS，3/3，91 outputs |
| Vue/React unit | PASS，13 files / 36 tests |
| Strict typecheck | PASS，`vue-tsc -b` |
| React 新页阻断 | PASS，20 baseline / 0 unexpected |
| Production build | PASS；Vue shell 59.18KB gzip，legacy leaf 109.98KB gzip lazy chunk |
| 生产包开发身份/患者文案扫描 | PASS |
| Playwright 194 路由 | PASS，194/194 H1、唯一一级激活、无横向溢出、0 console issue |
| 未知深链 | PASS，不回落门诊、不出现患者内容 |
| 根 `scripts/verify.sh` | PASS：数据库迁移/恢复、35 Java tests、100 AI eval、15 payload/12 surface、安全与追踪均通过 |

## 3. 测试发现与处置

1. 首次浏览器巡检为 181/194；13 个 legacy leaf 的旧导航虽被 CSS 隐藏，仍在 DOM 保留第二个 `aria-current`。适配器现将旧 chrome 设置 `hidden/aria-hidden` 并移除激活语义，复测 194/194。
2. TypeScript 7.0.2 改变 package export 后，最新 `vue-tsc 3.3.10` 无法加载 `typescript/lib/tsc`。为保留 `.vue` 严格类型门禁，前端精确固定 TypeScript 6.0.3；没有绕过类型检查。待 vue-tsc 官方兼容 TS7 后再单独升级取证。
3. 空后端时页面能 fail-closed，但浏览器会记录代理 502；启动 `dev-synthetic` 合成后端后，病历中心→门诊病历跳转和临床数据加载通过，console 0 error/warning。
4. 生产构建最初仍包含“合成患者甲”等演示名称。已集中到 `import.meta.env.DEV` 分支，生产包仅保留中性文案，并由安全脚本阻断回归。

## 4. 未关闭边界

- React 19 仍存在于 13 个 lazy leaf，不能宣称完成 Vue 单栈退场；U01-V2/V3/V5 必须继续。
- 194 个路由“已注册且安全可达”不等于 194 项业务已实现；`NOT_AVAILABLE` 页面必须随各业务任务逐项替换。
- 正式 OIDC、医院组织/患者选择器、生产 Logo 管理后台、CA/KMS 和真实医院 E2E 仍未完成。
