# 开源EMR调研工作底稿

## 2026-08-11 战略决策更新

- 本调研中的候选项目用于竞品、需求、许可、社区和工程经验比较，不再用于选择二次开发底座。
- 项目明确从零设计和实现中国 EMR 医疗业务内核；可使用数据库、框架、容器等通用组件，但不以 OpenEMR、OpenMRS、Medplum、Bahmni、OpenHIS 等现有 EMR/HIS/EHR 代码为产品基础。
- 产品目标不限定诊所，长期覆盖诊所、基层医疗机构及一二三级医院；采用同一临床内核、模块组合和不同部署画像。
- `emr_candidate_scores.csv` 中的 `long_term_base` 保留为历史研究字段，只代表原评分维度，不代表当前底座决策。
- 当前一级开源指标调整为 GitHub Stars 和稳定版本有效下载；商业化和机构活跃不作为前 180 天首要门禁。

## 调研边界

- 快照时间：2026-08-11，时区 Asia/Shanghai。
- “全部”按可决策范围解释为：公开可发现、具有独立项目身份的完整 EMR/EHR/HIS，外加构建中国医疗机构 EMR 不可绕开的临床数据平台和互操作组件。
- 不逐个收录 GitHub/Gitee 上的课程作业、简单 CRUD 演示、无许可证个人仓库和重复 fork；这些条目不具备生产底座意义。
- 真开源、源码可见、免费版和商业版严格区分。带有竞品限制或其他用途限制的项目不计为标准开源。

## 评价方法

候选集从长名单中筛出十项。原“短期试点”评分强调现成功能、部署、门诊闭环和真实运行证据；原“长期底座”评分强调架构、数据标准、中国适配、社区、许可证和可持续二开。各维度按 1–5 评分，再映射至 0–100。两项均为历史研究口径，当前只用于竞品比较和工程参考，不构成底座选择；评分也不是合规认证，不替代安全测试或法律意见。

## 图表契约

- 分析问题：不同项目在成品成熟度、现代工程、标准能力和中国适配方面有哪些可借鉴与规避之处？
- 结论：OpenEMR/Bahmni 更偏完整成品，Medplum/OpenMRS 更偏平台与临床内核参考；没有候选项目被选为本项目的开发底座。
- 图型：全宽、横向、分组条形图；项目为类别轴，短期试点与长期底座为两条数值系列；0–100，从零起点。
- 数据：10 个候选项目，每行保留角色、六个分项、许可和状态备注，超过绘图所需的最小字段，便于审计。
- 颜色：双根色上限；两系列使用蓝色与金色，并由图例和直接标签共同区分。
- 最终载体：Data Analytics MCP report 原生 chart block；在报告上下文内完成可读性检查。若继续使用“长期底座”字段，必须标注为历史评分口径而非当前战略选择。

## 关键事实来源

- OpenEMR 8.2.0、功能、FHIR、中文和许可证：<https://www.open-emr.org/downloads/>；<https://www.open-emr.org/wiki/index.php/OpenEMR_Features>
- OpenMRS 规模、O3、功能、架构和 FHIR：<https://openmrs.org/>；<https://openmrs.org/product/>；<https://openmrs.atlassian.net/wiki/spaces/docs/pages/25476856/Technical+Overview>
- Bahmni 产品组成与部署规模：<https://www.bahmni.org/>
- Medplum Apache-2.0 和平台能力：<https://github.com/medplum/medplum>
- EHRbase Apache-2.0 与 openEHR 后端定位：<https://www.ehrbase.org/>
- HAPI FHIR JPA Server：<https://hapifhir.io/hapi-fhir/docs/server_jpa/>
- GNU Health：<https://gnuhealth.org/download.html>
- Frappe Health：<https://healthcare.frappe.io/docs>
- OpenHIS Clinic：<https://gitee.com/tntlinking-opensource/openhis-clinic>
- 国内法规与标准：国家卫健委电子病历规范、病历管理规定、处方管理办法；中国人大网个人信息保护法和电子签名法；中国政府网网络数据安全管理条例；国家医保局 15 项编码标准。

## 风险记录

- OpenHIS Clinic 公开仓库页面出现疑似敏感环境配置痕迹。本报告不复制任何地址或凭据；若开展 PoC，应先通知维护方、轮换密钥并完成历史提交扫描。
- Ottehr 当前许可证包含竞品限制和 AI 使用限制，且运行依赖 Oystehr 账户，因此归入 source-available 排除项，而非开源候选。
- GitHub `pushed_at` 只能说明仓库发生推送，不能单独证明产品仍获维护；结论同时参考发布页、官网、文档和归档状态。
- 法规部分用于产品需求规划，不构成法律意见；上线前需要中国医疗信息化与数据合规律师复核，并核实目标省市医保、处方和监管平台接口要求。
