export type SimulationWorkbenchId =
  | 'admin-auth' | 'ai-capture' | 'model-connection' | 'model-routing'
  | 'devices' | 'device-monitoring' | 'integration-connectors' | 'integration-messages'
  | 'archive-scan' | 'archive-preservation' | 'pathology-workbench'
  | 'anesthesia-workbench' | 'therapy-workbench';

export interface SimulationWorkbenchDefinition {
  id: SimulationWorkbenchId;
  title: string;
  subtitle: string;
  systemType: string;
  interfaceCode?: string;
  entityLabel: string;
  entityKey: string;
  defaultEntity: string;
  steps: string[];
  safeguards: string[];
  resultFocus: string[];
}

export const simulationWorkbenches: Record<SimulationWorkbenchId, SimulationWorkbenchDefinition> = {
  'admin-auth': { id: 'admin-auth', title: '认证与 MFA 场景演练', subtitle: 'OIDC + PKCE、MFA 与会话任期的确定性身份模拟', systemType: 'IDENTITY', entityLabel: '合成主体', entityKey: 'subject', defaultEntity: '018f0000-0000-7000-8000-00000000aa04', steps: ['发起 OIDC 授权', '校验 PKCE', '执行 MFA', '建立限时会话'], safeguards: ['不接收真实口令', 'Token 不写日志', '高风险操作仍需 step-up'], resultFocus: ['authenticated', 'mfa', 'token_expires_in_seconds'] },
  'ai-capture': { id: 'ai-capture', title: '语音采集、转写与人工复核', subtitle: '从合成音频引用到逐句确认，不直接写入病历', systemType: 'DICTATION', entityLabel: '音频引用', entityKey: 'audio_ref', defaultEntity: 'synthetic://dictation/opd-001', steps: ['获取患者同意', '采集合成音频', 'ASR 分句转写', '医生逐句确认'], safeguards: ['未确认句不得入病历', '保留说话人和置信度', '原始音频按策略到期'], resultFocus: ['segments', 'unconfirmed_segments'] },
  'model-connection': { id: 'model-connection', title: '模型 Provider 连接与数据边界', subtitle: '验证兼容接口、驻留边界、引用和超时', systemType: 'MODEL', entityLabel: '模型名', entityKey: 'model', defaultEntity: 'MedBase-L-2.1', steps: ['最小化输入', '调用 Provider', '校验结构与引用', '人工采纳或拒绝'], safeguards: ['仅发送允许字段', '模型输出不是临床事实', '无引用结果默认降级'], resultFocus: ['model', 'output_text', 'citations', 'behavior'] },
  'model-routing': { id: 'model-routing', title: '模型路由、主备与人工降级', subtitle: '用成功、降级、不可用场景验证故障切换', systemType: 'MODEL', entityLabel: '路由策略', entityKey: 'route_policy', defaultEntity: 'clinical-summary-primary', steps: ['评估数据级别', '选择主模型', '触发备用路由', '进入人工处理'], safeguards: ['不可用时禁止静默成功', '降级结果显式标识不完整', '不得自动执行临床动作'], resultFocus: ['behavior', '_simulation', 'citations'] },
  devices: { id: 'devices', title: '设备目录、绑定与校准', subtitle: '设备身份、患者绑定、时钟偏移和校准场景', systemType: 'DEVICE', entityLabel: '设备 ID', entityKey: 'device_id', defaultEntity: 'BEDSIDE-MONITOR-01', steps: ['登记设备身份', '双标识绑定患者', '校准设备时钟', '启用遥测'], safeguards: ['绑定前不入患者视图', '时钟偏移超限需复核', '解绑必须留痕'], resultFocus: ['device_id', 'bound_patient', 'device_clock_offset_seconds'] },
  'device-monitoring': { id: 'device-monitoring', title: '设备遥测、趋势与告警', subtitle: '演练趋势接收、质量标记、阈值告警和人工确认', systemType: 'DEVICE', entityLabel: '设备 ID', entityKey: 'device_id', defaultEntity: 'BEDSIDE-MONITOR-01', steps: ['接收遥测', '校验绑定和时钟', '计算趋势', '确认或升级告警'], safeguards: ['缺测不显示为正常', '设备值需来源标识', '告警关闭需责任人'], resultFocus: ['telemetry', 'device_clock_offset_seconds', '_simulation'] },
  'integration-connectors': { id: 'integration-connectors', title: '集成连接器目录与健康', subtitle: 'LIS/PACS/HIS/CA 标准接口、连通性与降级状态', systemType: 'INTEGRATION_', entityLabel: '合成业务键', entityKey: 'encounter_id', defaultEntity: '018f0000-0000-7000-8000-000000000101', steps: ['选择连接器', '校验契约版本', '执行健康调用', '记录适配状态'], safeguards: ['凭据仅用 secret reference', '失败不伪装成空数据', '重试必须幂等'], resultFocus: ['_simulation', 'results', 'report_status', 'settlement_status'] },
  'integration-messages': { id: 'integration-messages', title: '集成消息 Trace 与重试', subtitle: '以确定性业务键演练请求、响应、失败和重试', systemType: 'INTEGRATION_', entityLabel: 'Trace 业务键', entityKey: 'trace_key', defaultEntity: 'synthetic-trace-001', steps: ['建立 Trace', '发送标准消息', '接收确认', '幂等重试/人工处理'], safeguards: ['消息正文脱敏', '相同业务键不重复副作用', '死信只能授权重放'], resultFocus: ['_simulation', 'critical_values', 'claim_id', 'timestamp_token'] },
  'archive-scan': { id: 'archive-scan', title: '纸质病历扫描、OCR 与编目', subtitle: '扫描批次、页序、OCR 复核和完整性校验', systemType: 'ARCHIVE_SCAN', entityLabel: '扫描批次', entityKey: 'batch_id', defaultEntity: 'SCAN-SYNTHETIC-001', steps: ['建立扫描批次', '采集并校验页序', 'OCR 与目录建议', '人工确认入档'], safeguards: ['OCR 不覆盖原图', '缺页必须阻断', '确认前不得归档终态'], resultFocus: ['batch_id', 'pages', 'integrity'] },
  'archive-preservation': { id: 'archive-preservation', title: '病案长期保存与恢复验证', subtitle: '内容哈希、WORM 保留期、抽样恢复和一致性证据', systemType: 'ARCHIVE_STORAGE', entityLabel: '内容引用', entityKey: 'content_ref', defaultEntity: 'synthetic://archive/case-001', steps: ['校验封包哈希', '写入长期保存', '执行保留策略', '抽样恢复比对'], safeguards: ['哈希不一致立即阻断', '保留期不可缩短', '恢复验证只读'], resultFocus: ['storage_ref', 'content_hash', 'retention_years', 'sealed'] },
  'pathology-workbench': { id: 'pathology-workbench', title: '病理标本到诊断签署', subtitle: '从取材、制片、诊断复核到签署的状态轴', systemType: 'PATHOLOGY', entityLabel: '标本 ID', entityKey: 'specimen_id', defaultEntity: 'PATH-SYNTHETIC-001', steps: ['接收并核对标本', '取材与制片', '病理诊断', '复核签署'], safeguards: ['标本身份不一致阻断', '诊断须独立复核', '签署前保留切片证据'], resultFocus: ['specimen_id', 'stages', 'diagnosis_status'] },
  'anesthesia-workbench': { id: 'anesthesia-workbench', title: '麻醉评估、事件轴与复苏', subtitle: '术前评估、诱导、监护事件和 PACU 去向演练', systemType: 'ANESTHESIA', entityLabel: '就诊 ID', entityKey: 'encounter_id', defaultEntity: '018f0000-0000-7000-8000-000000000101', steps: ['术前评估核验', '麻醉诱导', '连续事件记录', '复苏评分与去向'], safeguards: ['事件轴只追加不覆盖', '异常体征需处置记录', '复苏去向由医生确认'], resultFocus: ['event_axis', 'monitoring', 'recovery_disposition'] },
  'therapy-workbench': { id: 'therapy-workbench', title: '治疗排程、核对与执行', subtitle: '排程、患者/医嘱双核对、执行与不良事件闭环', systemType: 'THERAPY', entityLabel: '治疗任务', entityKey: 'therapy_id', defaultEntity: 'THER-SYNTHETIC-001', steps: ['读取治疗排程', '患者与医嘱核对', '双人确认执行', '记录结果/不良事件'], safeguards: ['核对失败禁止执行', '高风险治疗双签', '不良事件必须升级'], resultFocus: ['therapy_id', 'verification', 'status', 'adverse_event'] },
};

export function simulationWorkbench(id: SimulationWorkbenchId) {
  return simulationWorkbenches[id];
}
