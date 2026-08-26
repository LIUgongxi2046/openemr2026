import type { AgentRegistryWire } from '../generated/contracts';

export interface AssistantAgentTask {
  id: string;
  label: string;
  prompt: string;
}

export interface AssistantAgentDescriptor {
  code: string;
  icon: string;
  description: string;
  timing: string;
  boundary: string;
  tasks: AssistantAgentTask[];
}

export interface AvailableAssistantAgent extends AssistantAgentDescriptor {
  registry: AgentRegistryWire;
}

export const assistantAgentCatalog: AssistantAgentDescriptor[] = [
  {
    code: 'OPD_COPILOT', icon: '诊', description: '汇总当次门诊资料，整理待确认问题和诊疗下一步。',
    timing: '进入门诊工作台、切换患者或准备结束接诊时', boundary: '仅生成候选，不确认诊断、不签署医嘱。',
    tasks: [
      { id: 'opd-summary', label: '生成门诊摘要', prompt: '请基于当前就诊资料生成结构化门诊摘要，列出来源、缺失资料和待人工确认项。' },
      { id: 'opd-next', label: '梳理下一步', prompt: '请梳理当前门诊诊疗的下一步候选，区分必须完成、建议完成和需要补充证据的事项。' },
    ],
  },
  {
    code: 'DIAGNOSIS_REVIEW', icon: '析', description: '检查诊断依据、鉴别方向和术语编码的一致性。',
    timing: '新增或确认诊断前，以及病情资料发生变化后', boundary: '不能自动确诊、停止或更正诊断。',
    tasks: [
      { id: 'diagnosis-evidence', label: '核对诊断依据', prompt: '请核对当前诊断候选与现有证据的一致性，列出支持证据、反证和缺失信息。' },
      { id: 'diagnosis-differential', label: '生成鉴别清单', prompt: '请生成按优先级排序的鉴别诊断候选，并为每项标明支持点、排除点和建议补充检查。' },
    ],
  },
  {
    code: 'ORDER_SAFETY', icon: '药', description: '解释用药与医嘱风险，提示重复、剂量和执行前置条件。',
    timing: '新建医嘱、处方签署前或结果异常需要调整方案时', boundary: '确定性硬规则由服务端执行；Agent 不能绕过阻断。',
    tasks: [
      { id: 'order-review', label: '审阅当前医嘱', prompt: '请审阅当前医嘱候选，说明适应证、重复风险、剂量与监测注意事项；不要替代确定性安全规则。' },
      { id: 'medication-education', label: '生成用药交代', prompt: '请基于当前处方生成患者可理解的用药交代草稿，包含用法、常见风险和复诊触发条件。' },
    ],
  },
  {
    code: 'RESULT_TRIAGE', icon: '检', description: '解读检查检验趋势，优先突出危急值和待闭环异常。',
    timing: '新结果到达、危急值出现或复查结果返回时', boundary: '不能代替复读确认和临床处置留痕。',
    tasks: [
      { id: 'result-summary', label: '解读结果趋势', prompt: '请按危急、异常、正常分层总结当前检查检验结果，给出来源并标注不能判断的部分。' },
      { id: 'critical-checklist', label: '危急值核对清单', prompt: '请生成危急值人工处置核对清单，包含复读、评估、措施、结果和复测决策，不要声称已完成处置。' },
    ],
  },
  {
    code: 'DOCUMENT_QC', icon: '质', description: '检查病历结构、证据完整性和前后矛盾。',
    timing: '病历保存后、签署前及质控退回后', boundary: '不覆盖原文，不代替作者或审签人。',
    tasks: [
      { id: 'document-qc', label: '执行病历预检', prompt: '请对当前病历进行签署前预检，列出缺失字段、前后矛盾、时序问题和建议修订点。' },
      { id: 'document-draft', label: '生成补充草稿', prompt: '请根据当前资料生成缺失段落的候选草稿，逐段附来源并明确需要医生确认。' },
    ],
  },
  {
    code: 'CARE_COORDINATOR', icon: '协', description: '整理会诊、转诊、任务和随访的协作信息。',
    timing: '发起会诊转诊、交接班、出院或建立随访时', boundary: '不自动发送申请、不改变任务归属。',
    tasks: [
      { id: 'consult-brief', label: '生成会诊摘要', prompt: '请生成会诊或转诊摘要候选，包含申请原因、关键病史、检查、当前处置和期望解决的问题。' },
      { id: 'followup-plan', label: '生成随访计划', prompt: '请生成可追踪的随访计划草稿，列出时间点、观察指标、异常触发条件和责任角色。' },
    ],
  },
];

export function availableAssistantAgents(registry: AgentRegistryWire[]): AvailableAssistantAgent[] {
  const active = new Map(registry.filter((agent) => agent.status === 'ACTIVE').map((agent) => [agent.agent_code, agent]));
  return assistantAgentCatalog.flatMap((descriptor) => {
    const agent = active.get(descriptor.code);
    return agent ? [{ ...descriptor, registry: agent }] : [];
  });
}
