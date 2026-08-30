export type QualityOperationModuleId =
  | 'quality-center'
  | 'department-qc'
  | 'quality-rating'
  | 'infection-events'
  | 'credentials';

export interface QualityOperationStatus {
  value: string;
  label: string;
  terminal?: boolean;
}

export interface QualityOperationDefinition {
  id: QualityOperationModuleId;
  configType: string;
  codePrefix: string;
  title: string;
  itemLabel: string;
  description: string;
  flowImpact: string;
  workflow: readonly string[];
  statuses: readonly QualityOperationStatus[];
  routeBase: string;
}

export const qualityOperationDefinitions: Record<QualityOperationModuleId, QualityOperationDefinition> = {
  'quality-center': {
    id: 'quality-center', configType: 'QUALITY_INITIATIVE', codePrefix: 'QI',
    title: '院级质量改进项目', itemLabel: '质量项目',
    description: '把院级指标异常转成有责任人、范围、时限与处置动作的改进项目。',
    flowImpact: '未闭环的阻断项目进入院级风险队列，并计入医疗质量中心指标。',
    routeBase: '/quality-center/initiatives',
    workflow: ['识别指标异常', '建立改进项目', '执行干预', '复核并闭环'],
    statuses: [
      { value: 'MONITORING', label: '持续监测' }, { value: 'IMPROVING', label: '整改中' },
      { value: 'REVIEW', label: '待复核' }, { value: 'CLOSED', label: '已闭环', terminal: true },
    ],
  },
  'department-qc': {
    id: 'department-qc', configType: 'DEPARTMENT_QC_CASE', codePrefix: 'DQC',
    title: '院科质控缺陷与整改', itemLabel: '质控缺陷',
    description: '按院区、科室、病区、文书类型和责任人管理抽查、缺陷、整改与复核。',
    flowImpact: '开放缺陷进入责任科室整改队列；阻断缺陷未闭环时影响终末质控与归档准备。',
    routeBase: '/department-qc/cases',
    workflow: ['定义抽样范围', '运行规则/人工抽查', '分派缺陷', '整改复核闭环'],
    statuses: [
      { value: 'OPEN', label: '待分派' }, { value: 'REMEDIATING', label: '整改中' },
      { value: 'REVIEW', label: '待复核' }, { value: 'CLOSED', label: '已闭环', terminal: true },
    ],
  },
  'quality-rating': {
    id: 'quality-rating', configType: 'QUALITY_RATING_EVIDENCE', codePrefix: 'QRE',
    title: '评级项目与证据快照', itemLabel: '评级证据',
    description: '逐项管理评价标准、证据责任人、证据缺口与取证有效期。',
    flowImpact: '未验证或逾期证据形成评级缺口，阻止对应评价项目标记为达标。',
    routeBase: '/quality-rating/evidence-items',
    workflow: ['映射评价项目', '采集证据', '质量校验', '固化证据快照'],
    statuses: [
      { value: 'GAP', label: '证据缺口' }, { value: 'COLLECTING', label: '取证中' },
      { value: 'READY', label: '待验证' }, { value: 'VERIFIED', label: '已验证', terminal: true },
    ],
  },
  'infection-events': {
    id: 'infection-events', configType: 'INFECTION_CONTROL_CASE', codePrefix: 'IC',
    title: '院感整改与防控任务', itemLabel: '院感任务',
    description: '把已上报线索、人工复核和防控措施组织成可追踪的整改任务。',
    flowImpact: '确认的高风险院感任务进入防控队列，逾期未控制时持续升级。',
    routeBase: '/infection-events/control-tasks',
    workflow: ['线索上报', '人工复核', '执行防控措施', '效果复核闭环'],
    statuses: [
      { value: 'REPORTED', label: '已上报' }, { value: 'INVESTIGATING', label: '调查中' },
      { value: 'CONTROLLED', label: '已控制' }, { value: 'CLOSED', label: '已闭环', terminal: true },
    ],
  },
  credentials: {
    id: 'credentials', configType: 'CLINICAL_CREDENTIAL_GRANT', codePrefix: 'CG',
    title: '临床资质授权计划', itemLabel: '授权计划',
    description: '管理处方、医嘱、手术、技术和临时授权的申请、有效期与撤销计划。',
    flowImpact: '待审批、即将到期或撤销的授权进入医务管理队列；关键临床动作仍执行实时鉴权。',
    routeBase: '/credentials/authorization-plans',
    workflow: ['提交授权范围', '资质与岗位核验', '授权生效', '到期/撤销复核'],
    statuses: [
      { value: 'PENDING', label: '待审批' }, { value: 'ACTIVE', label: '有效授权' },
      { value: 'EXPIRING', label: '即将到期' }, { value: 'REVOKED', label: '已撤销', terminal: true },
    ],
  },
};

export function qualityOperation(moduleId: QualityOperationModuleId): QualityOperationDefinition {
  return qualityOperationDefinitions[moduleId];
}
