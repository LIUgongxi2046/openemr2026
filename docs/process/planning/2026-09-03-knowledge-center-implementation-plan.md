# 知识中心实施任务 DAG（S007）

> - 日期：2026-09-03
> - 输入：知识中心 PRD / HLD / LLD-DATA / LLD-AGENT（均 v0.1~v0.3）
> - 目标：医院维护知识场景端到端纵向切片（导入 → 维护 → 评审发布 → 检索 → Agent 联动）

## 0. 纵向切片（首个可验收切片）

「知识库管理员从外部 Obsidian 库只读选择性导入 → 维护文档（编辑/元数据/双链）→ 提交评审 → 发布版本 → 临床使用者 FTS 检索 → Agent 受控检索」。图谱与反馈闭环并入首版但可降级；pgvector 语义检索留 V352+。

## 1. 任务 DAG

| # | 任务 | 依赖 | 验证 | 门禁 |
|---|---|---|---|---|
| T1 | 迁移 V351 知识中心核心表 | — | `scripts/test-schema.sh` / 启动 Flyway | 迁移前进+回退 |
| T2 | OpenAPI 契约：KnowledgeSource/Document/Version/Chunk/Concept/Relation/RetrievalLog/Feedback schemas + paths | — | `npm --prefix contracts run generate` + `--check` | 契约生成一致 |
| T3 | 后端 `knowledge` 包：SourceService（登记+只读选择性导入） | T1/T2 | 单元测试 | 幂等+只读+白名单 |
| T4 | 后端 DocumentService（创建/编辑/提交评审/发布/回退/退役） | T1/T2 | 单元测试 | 状态机+不可变触发器 |
| T5 | 后端 SearchService（FTS+精确+图 depth≤2）+ RetrievalLog/Feedback | T1/T2 | 单元测试 | 引用可寻址 |
| T6 | Agent 工具接入：knowledge_search/lookup/graph 注册 + ToolGateway 接线 | T5 | 契约测试 | 越权=0 |
| T7 | 前端：ClinicalShell 菜单 + 知识中心页面族 + router 注册 + api client | T2/T5 | 全路由审计 | 194 路由不回归 |
| T8 | S009 测试：单元/契约/端到端 + 医院维护知识回归脚本 | T3–T7 | `scripts/verify.sh` | 全绿 |
| T9 | S010 安全：威胁建模 + 越权/注入/只读校验 | T3–T7 | 红队 | 0 高危 |

## 2. 并行组

- T2（契约）与 T1（迁移）可并行。
- T3/T4/T5 依赖 T1/T2，可部分并行（不同 Service）。
- T7 前端依赖 T2（contracts.ts）+ T5（api 联调）。
- T8/T9 在 T3–T7 后收口。

## 3. 风险与回滚

- 风险：pgvector 未安装（首版 FTS 降级）；选择矩阵表级白名单未定（首版分类级白名单）；契约为 552 schema，新增需保证 `--check` 一致。
- 回滚：迁移可回退；前端路由可撤回；Agent 工具仅注册不自动开放（需 release 评审）。
- 完成定义：医院维护知识场景端到端（导入→维护→发布→检索→Agent）通过自动化门禁，且越权引用=0、可寻址引用=100%、源文件零写回。

## 4. 首次执行顺序

T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9。
