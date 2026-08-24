export type ConfigurationFieldKind = 'text' | 'textarea' | 'list' | 'number' | 'boolean';

export interface ConfigurationFieldDefinition {
  key: string;
  label: string;
  kind: ConfigurationFieldKind;
  placeholder: string;
  defaultValue: string;
  minimum?: number;
  maximum?: number;
}

export interface ConfigurationStudioDefinition {
  routeId: string;
  configType: string;
  title: string;
  subtitle: string;
  keyPlaceholder: string;
  previewTitle: string;
  safetyNote: string;
  fields: ConfigurationFieldDefinition[];
}

const field = (
  key: string,
  label: string,
  kind: ConfigurationFieldKind,
  defaultValue: string,
  placeholder = defaultValue,
  limits: Pick<ConfigurationFieldDefinition, 'minimum' | 'maximum'> = {},
): ConfigurationFieldDefinition => ({ key, label, kind, defaultValue, placeholder, ...limits });

export const configurationStudios: Readonly<Record<string, ConfigurationStudioDefinition>> = Object.freeze({
  workflow: {
    routeId: 'workflow', configType: 'WORKFLOW', title: '流程与状态设计器',
    subtitle: '节点、分支终态、受保护节点和超时升级统一版本化', keyPlaceholder: 'inpatient-consult-v1',
    previewTitle: '流程画布', safetyNote: '签署、审计节点受保护，无终态分支不得发布。',
    fields: [field('nodes', '节点', 'list', '发起,科室接收,专家意见,签署,审计,完成'), field('edges', '连线', 'list', '发起->科室接收,科室接收->专家意见,专家意见->签署,签署->审计,审计->完成'), field('protected_nodes', '受保护节点', 'list', '签署,审计'), field('timeout_policy', '超时升级', 'textarea', '2 小时提醒，4 小时升级到科主任')],
  },
  'form-designer': {
    routeId: 'form-designer', configType: 'FORM_TEMPLATE', title: '表单与病历模板设计器', subtitle: '字段、分组、术语映射、打印预览与历史版本', keyPlaceholder: 'opd-record-v1', previewTitle: '表单预览', safetyNote: '已发布模板不覆盖旧病历绑定的版本。',
    fields: [field('fields', '字段', 'list', '主诉,现病史,既往史,体格检查,诊断'), field('groups', '分组', 'list', '病史,检查,诊断'), field('terminology_mapping', '术语映射', 'textarea', 'diagnosis -> ICD-10; symptom -> WS 445.2'), field('print_template', '打印模板', 'text', 'A4-门诊病历-v1')],
  },
  'rule-center': {
    routeId: 'rule-center', configType: 'RULE', title: '规则、时限与提示设计器', subtitle: '区分医疗硬规则、机构规则、提醒与 AI 建议', keyPlaceholder: 'pediatric-dose-v1', previewTitle: '命中路径', safetyNote: '机构规则不能降级数据库医疗硬门。',
    fields: [field('conditions', '条件组', 'list', '年龄<14,药品类型=处方,体重已记录'), field('actions', '动作', 'list', '校验体重剂量,阻断超范围处方'), field('rule_layer', '规则层级', 'text', 'CLINICAL_HARD_GATE'), field('sample_case', '测试病例', 'textarea', '6 岁，20kg，阿莫西林克拉维酸处方')],
  },
  'scope-designer': {
    routeId: 'scope-designer', configType: 'SCOPE', title: '角色、职责与数据范围设计器', subtitle: '组织、岗位、患者关系、临时授权和职责分离', keyPlaceholder: 'cross-department-review-v1', previewTitle: '权限模拟', safetyNote: '临时授权必须到期，作者与审批人不得为同一人。',
    fields: [field('roles', '角色', 'list', '作者,审批人,跨科医生'), field('data_scopes', '数据范围', 'list', '本科就诊,授权患者,脱敏汇总'), field('separation_of_duties', '职责分离', 'textarea', '作者!=审批人；跨科医生只读'), field('temporary_grant_hours', '临时授权小时', 'number', '4', '1-24', { minimum: 1, maximum: 24 })],
  },
  'agent-compose': {
    routeId: 'agent-compose', configType: 'AGENT_COMPOSITION', title: 'Agent / Skill / Tool 组合画布', subtitle: '版本锁定、权限交集、预算、停止条件与补偿', keyPlaceholder: 'clinical-summary-agent-v1', previewTitle: 'Agent 依赖图', safetyNote: 'Agent 不获得独立临床写权限，依赖停用或权限扩大时阻断发布。',
    fields: [field('agents', 'Agent', 'list', 'clinical-summary-agent@1'), field('skills', 'Skills', 'list', 'summarize-record@3,retrieve-evidence@2'), field('tools', 'Tools', 'list', 'record.read@2,timeline.read@1'), field('budget_tokens', 'Token 预算', 'number', '6000', '100-20000', { minimum: 100, maximum: 20000 }), field('stop_conditions', '停止条件', 'textarea', '无授权来源；超预算；患者上下文变化'), field('compensation', '补偿策略', 'textarea', '取消未执行工具，转人工复核并对账')],
  },
  'agent-context': {
    routeId: 'agent-context', configType: 'AGENT_CONTEXT', title: 'Agent 上下文策略', subtitle: '最小数据源、时间窗、脱敏、来源和失效条件', keyPlaceholder: 'opd-context-v1', previewTitle: '上下文预览', safetyNote: '患者或就诊变化使旧 ContextLease 立即失效。',
    fields: [field('data_sources', '数据源', 'list', 'DOCUMENT_VERSION,OBSERVATION,ORDER,RULE'), field('allowed_fields', '允许字段', 'list', '主诉,现病史,诊断,医嘱,结果'), field('time_window_hours', '时间窗小时', 'number', '72', '1-720', { minimum: 1, maximum: 720 }), field('redaction_policy', '脱敏策略', 'textarea', '隐藏身份证号、电话和住址；仅保留最小必要字段'), field('freshness_minutes', '新鲜度分钟', 'number', '5', '1-60', { minimum: 1, maximum: 60 })],
  },
  'agent-evals': {
    routeId: 'agent-evals', configType: 'AGENT_EVAL', title: 'Agent 评估与发布门禁', subtitle: '数据集版本、阈值、红队、结论和差异', keyPlaceholder: 'clinical-agent-eval-v1', previewTitle: '评估门禁', safetyNote: '低于阈值、红队失败或版本不可追溯时禁止发布。',
    fields: [field('dataset_version', '数据集版本', 'text', 'clinical-ai-golden-v1'), field('case_count', '用例数', 'number', '100', '1-10000', { minimum: 1, maximum: 10000 }), field('pass_threshold', '通过阈值', 'number', '0.95', '0-1', { minimum: 0, maximum: 1 }), field('red_team_profile', '红队策略', 'textarea', '越权、Prompt 注入、临床自动动作、敏感数据外泄')],
  },
  'ai-assistant-policy': {
    routeId: 'ai-assistant-policy', configType: 'AI_ASSISTANT_POLICY', title: '临床 AI 助手策略', subtitle: '主动级别、允许来源、模型、限频与动作审批', keyPlaceholder: 'opd-assistant-policy-v1', previewTitle: '策略模拟', safetyNote: '无来源回答和未审批副作用必须阻断。',
    fields: [field('proactive_level', '主动级别', 'text', 'REMIND_ONLY'), field('allowed_sources', '允许来源', 'list', 'DOCUMENT_VERSION,OBSERVATION,ORDER,RULE'), field('model_policy', '模型策略', 'text', 'ON_PREM_FIRST_WITH_MANUAL_FALLBACK'), field('rate_limit', '每分钟限频', 'number', '10', '1-60', { minimum: 1, maximum: 60 }), field('approval_required', '副作用需审批', 'boolean', 'true')],
  },
  'config-release': {
    routeId: 'config-release', configType: 'CONFIG_RELEASE', title: '配置差异、审批与灰度发布', subtitle: '验证证据、职责分离、灰度范围、失败补偿和回退', keyPlaceholder: 'release-2026-08-v1', previewTitle: '发布管道', safetyNote: '作者不能批准自己，失败版本不得进入 ACTIVE。',
    fields: [field('diff_summary', '差异摘要', 'textarea', '新增门诊会诊超时升级节点'), field('validation_evidence', '验证证据', 'list', 'schema-pass,simulation-pass,security-pass'), field('rollout_scope', '灰度范围', 'list', '总院门诊,心内科'), field('rollback_plan', '回退计划', 'textarea', '恢复上一 ACTIVE 版本并保留审计证据')],
  },
  'config-upgrade': {
    routeId: 'config-upgrade', configType: 'CONFIG_UPGRADE', title: '配置包升级与冲突处理', subtitle: '兼容检查、冲突决议、迁移预演与恢复点', keyPlaceholder: 'package-upgrade-v1', previewTitle: '升级预演', safetyNote: '破坏性字段删除必须阻断，预演与实际 checksum 必须一致。',
    fields: [field('package_version', '配置包版本', 'text', '2026.08.1'), field('compatibility', '兼容结论', 'textarea', '兼容 V166；不允许删除已引用字段'), field('conflicts', '冲突决议', 'list', '保留本地科室范围,接受产品新规则'), field('recovery_point', '恢复点', 'text', 'config-checkpoint-before-2026.08.1')],
  },
  'admin-master-data': {
    routeId: 'admin-master-data', configType: 'MASTER_DATA', title: '医院主数据管理', subtitle: '编码、层级、有效期、批量导入与引用影响', keyPlaceholder: 'department-codes-v1', previewTitle: '主数据树', safetyNote: '已被临床事实引用的值只能停用，不得物理删除。',
    fields: [field('code_system', '编码体系', 'text', 'OPENEMR2026-DEPARTMENT'), field('hierarchy', '层级', 'list', '医院>院区>科室>病区'), field('effective_period', '有效期', 'text', '2026-01-01/2099-12-31'), field('import_policy', '导入策略', 'textarea', '重复编码阻断；逐项回传结果；已引用值仅停用')],
  },
  'admin-parameters': {
    routeId: 'admin-parameters', configType: 'PARAMETER', title: '系统参数与功能开关', subtitle: '强类型、作用域、继承、敏感引用、生效时间和回退', keyPlaceholder: 'clinical-ai-enabled-v1', previewTitle: '参数继承', safetyNote: '秘密只允许 env:// 或 file:// 引用，高风险参数需双人审批。',
    fields: [field('value_type', '值类型', 'text', 'BOOLEAN'), field('scope', '作用域', 'text', 'FACILITY'), field('inheritance', '继承', 'textarea', 'FACILITY -> ORGANIZATION -> GLOBAL'), field('secret_reference', '秘密引用', 'text', 'env://OPENEMR2026_MODEL_API_KEY'), field('effective_at', '生效时间', 'text', '2026-08-25T00:00:00+08:00')],
  },
  'admin-jobs': {
    routeId: 'admin-jobs', configType: 'JOB', title: '通知调度与批量任务', subtitle: '批次、进度、部分成功、失败项幂等重试和对账', keyPlaceholder: 'notification-reconcile-v1', previewTitle: '批次执行图', safetyNote: '成功项不重复，只重试失败项，每项保留 Outbox 证据。',
    fields: [field('schedule', '调度策略', 'text', '0 */5 * * * *'), field('batch_size', '批次数', 'number', '1650', '1-10000', { minimum: 1, maximum: 10000 }), field('retry_policy', '重试策略', 'textarea', '只重试隔离失败项；1m/5m/15m；最多 3 次'), field('reconciliation_rule', '业务对账', 'textarea', '成功 1642，隔离 8，总数必须为 1650')],
  },
  backup: {
    routeId: 'backup', configType: 'BACKUP', title: '备份恢复与完整性报告', subtitle: '备份台账、checksum、恢复演练、RPO/RTO 与保留', keyPlaceholder: 'synthetic-backup-v1', previewTitle: '恢复演练', safetyNote: '仅针对合成库执行，报告必须包含版本和 checksum。',
    fields: [field('repository', '备份仓库', 'text', 'file:///private/tmp/openemr2026-backups'), field('retention_days', '保留天数', 'number', '30', '1-3650', { minimum: 1, maximum: 3650 }), field('rpo_minutes', 'RPO 分钟', 'number', '15', '0-1440', { minimum: 0, maximum: 1440 }), field('rto_minutes', 'RTO 分钟', 'number', '60', '1-10080', { minimum: 1, maximum: 10080 }), field('checksum_policy', 'Checksum 策略', 'text', 'SHA-256 + row-count fingerprint')],
  },
  install: {
    routeId: 'install', configType: 'INSTALL', title: '安装向导与首次健康检查', subtitle: '环境预检、分步安装、断点恢复和安全清理', keyPlaceholder: 'site-install-v1', previewTitle: '安装步骤', safetyNote: '缺 JDK/DB/OIDC 等前置必须失败关闭，重试不重复创建。',
    fields: [field('prerequisites', '环境前置', 'list', 'JDK21,PostgreSQL18,OIDC,KMS,ObjectStorage'), field('database_profile', '数据库配置', 'text', 'postgresql-production'), field('identity_profile', '身份配置', 'text', 'oidc-mfa-production'), field('resume_step', '断点步骤', 'text', 'PRECHECK')],
  },
  operations: {
    routeId: 'operations', configType: 'OPERATION', title: '生产运行、灾备与停机续运', subtitle: '服务健康、事件、维护窗、积压、恢复步骤与证据', keyPlaceholder: 'operations-policy-v1', previewTitle: '运行拓扑', safetyNote: '任何依赖失败都必须显示影响和恢复动作，不硬编码“一切正常”。',
    fields: [field('health_checks', '健康检查', 'list', 'database,outbox,identity,storage,integrations'), field('maintenance_window', '维护窗', 'text', '周日 02:00-04:00 Asia/Shanghai'), field('downtime_mode', '停机续运', 'textarea', '临床只读；本地草稿；恢复后对账'), field('recovery_steps', '恢复步骤', 'list', '隔离故障,恢复依赖,重放Outbox,业务对账,解除降级')],
  },
  'release-gates': {
    routeId: 'release-gates', configType: 'RELEASE_GATE', title: 'Release 门禁与制品发布', subtitle: '候选版本、契约、迁移、测试、安全、备份和回滚证据', keyPlaceholder: 'release-candidate-v1', previewTitle: 'GO / NO-GO', safetyNote: '缺任一 P0 门禁或 commit/制品/DB 版本不一致时必须 NO-GO。',
    fields: [field('candidate_commit', '候选 commit', 'text', 'UNCOMMITTED-LOCAL-CANDIDATE'), field('required_gates', '必需门禁', 'list', 'contracts,migrations,backend-tests,frontend-tests,browser-194,security,backup-restore'), field('artifact_checksum', '制品 checksum', 'text', 'sha256:pending-build'), field('rollback_entry', '回滚入口', 'textarea', '恢复上一候选制品，数据库只追加 forward-fix')],
  },
});

export function configurationStudio(routeId: string): ConfigurationStudioDefinition {
  const definition = configurationStudios[routeId];
  if (!definition) throw new Error(`Unknown configuration studio: ${routeId}`);
  return definition;
}
