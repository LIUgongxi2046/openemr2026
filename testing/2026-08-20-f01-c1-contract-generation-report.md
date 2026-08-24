# F01-C1 全量机器契约生成与漂移门禁测试报告

- 日期：2026-08-20
- S009 模式：IMPLEMENT + EXECUTE + REPORT
- 对应任务：`F01-C1`
- 环境：macOS、本地 PostgreSQL 18 隔离实例（Unix socket `/private/tmp`，端口 `55432`）、Eclipse Temurin JDK 21.0.10、Gradle 9.6.1、Node.js workspace runtime
- 数据：仅使用仓库内明确标记的合成数据，无真实患者数据

## 1. 结果

`F01-C1` 本地门禁通过，可转入 `U01-V1`。这不等于真实医院生产放行，也不代表远端 GitHub CI 已执行。

生成制品：

- 物理字段字典：702 字段，来源 V1–V22 migration
- API index：62 operations，其中 10 个关键操作使用 S005 显式策略
- 稳定错误目录：16 项
- 事件 index：2 项
- Agent/Tool registry：4 Agent、5 Tool，引用闭合
- route contract：194/194 路由，覆盖 138/138 FR
- Java/TypeScript OpenAPI/Route Registry 生成输出：91 个确定性输出文件

## 2. 执行证据

| 门禁 | 命令 | 结果 |
|---|---|---|
| 生成器语法 | `node --check contracts/generate.mjs` | PASS |
| 契约生成 | `npm --prefix contracts run generate` | PASS |
| producer/consumer 与治理引用 | `npm --prefix contracts test` | PASS，3/3 |
| 确定性漂移 | `npm --prefix contracts run check` | PASS，91 outputs |
| FR/AC/路由追踪 | `node prototype/app/verify-traceability.mjs` | PASS，138/138 |
| 路由契约 | `node prototype/app/verify-route-contract.mjs` | PASS，194/194；专科 70/70 |
| Java 集成 | `./gradlew test`（JDK 21 wrapper） | PASS，35/35，0 failure，0 error |
| Web 单测 | `npm --prefix web test` | PASS，11 files / 30 tests |
| Web 生产构建 | `npm --prefix web run build` | PASS，Vite 8.2.1 |
| AI 合成 eval | 根验证脚本 | PASS，100/100 |
| 安全 payload/surface | 根验证脚本 | PASS，15 payloads / 12 surfaces |
| V1–V22 迁移事务回滚 | 根验证脚本 | PASS |
| 备份恢复指纹 | 根验证脚本 | PASS，17/20/6/9/5/1/1/4/1 行级计数及 6 个内容指纹一致 |
| 凭据与生产包身份扫描 | `scripts/security-scan.sh` | PASS |
| 统一回归 | `scripts/verify.sh` | PASS |

## 3. 本轮发现并修复的问题

1. `prototype/traceability.csv` 中 FR-009 仍引用已退场的 `#clinical-doc-editor`，已改为真实 `#record-editor`，避免生成路由契约把过期页面当成验收入口。
2. 空库首次启动时，V11 只能给迁移当时已有租户生成住院文书规则；`dev-synthetic` 租户后创建，导致住院任务 `required_signature_level` 为 null。已在合成租户导入事务中幂等初始化完整 15 类住院文书规则。该修复保持数据库非空基线仍 fail-closed，没有启用 `baselineOnMigrate`。

## 4. 剩余边界

- 远端 GitHub CI 尚未执行，因此评审状态是 `LOCAL_VERIFIED`。
- SSE 断点续传、乱序/重复事件恢复和未知 schema version 的运行时消费门禁，分别在 A01/U01 消费端任务实现和取证；F01-C1 只固定 schema、版本、顺序键与生成契约。
- OIDC、CA/KMS、完整生产 secret-ref 仍属于 F01 余项，F01 总任务保持 `IN_PROGRESS`。
