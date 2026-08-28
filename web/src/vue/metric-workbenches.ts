export type MetricWorkbenchId = 'data-center' | 'research' | 'research-stats' | 'department-qc' | 'quality-center';

export interface MetricWorkbenchDefinition {
  id: MetricWorkbenchId;
  metricType: string;
  title: string;
  subtitle: string;
  perspective: string;
  defaultMetrics: string[];
  workflow: string[];
  links: { label: string; to: string }[];
}

export const metricWorkbenches: Record<MetricWorkbenchId, MetricWorkbenchDefinition> = {
  'data-center': { id: 'data-center', metricType: 'DATA_CENTER', title: '数据中心指标目录与血缘', subtitle: '从登记口径到事实表、公式、快照和使用方的可追溯指标目录', perspective: '数据治理', defaultMetrics: ['患者主档案', '就诊事实', '已签署病历', '医嘱事实'], workflow: ['登记口径', '绑定事实表', '计算快照', '发布给使用方'], links: [{ label: '数据质量规则', to: '/data-quality' }, { label: '科研队列', to: '/cohort-builder' }] },
  research: { id: 'research', metricType: 'RESEARCH', title: '科研项目与统计中心', subtitle: '活动队列、成员、数据申请审批和导出状态保持可审计', perspective: '科研治理', defaultMetrics: ['活动科研队列', '队列成员', '待审批数据申请', '已导出数据申请'], workflow: ['定义队列', '计算成员', '申请数据', '独立审批与导出'], links: [{ label: '队列构建', to: '/cohort-builder' }, { label: '研究数据申请', to: '/research-dataset' }] },
  'research-stats': { id: 'research-stats', metricType: 'RESEARCH_STATS', title: '科研统计分析', subtitle: '队列 v6 · 去标识聚合 · 结果快照 STAT-20260813-09', perspective: '统计分析', defaultMetrics: ['队列人数', '平均年龄', '血压达标率', '180 天随访'], workflow: ['选择快照', '核对纳排口径', '计算统计量', '导出汇总证据'], links: [{ label: '科研中心', to: '/research' }, { label: '研究数据集', to: '/research-dataset' }] },
  'department-qc': { id: 'department-qc', metricType: 'DEPARTMENT_QC', title: '院科病历质控与整改', subtitle: '质控运行、阻断、开放问题和整改闭环按科室工作流呈现', perspective: '病历质控', defaultMetrics: ['质控运行', '阻断运行', '开放问题', '已整改问题'], workflow: ['执行规则', '分派问题', '科室整改', '复核闭环'], links: [{ label: '病历质控', to: '/record-qc' }, { label: '医疗质量中心', to: '/quality-center' }] },
  'quality-center': { id: 'quality-center', metricType: 'QUALITY_CENTER', title: '医疗质量中心', subtitle: '质控通过率、阻断问题、警告和整改闭环的院级质量视图', perspective: '院级质量', defaultMetrics: ['病历质控通过率', '阻断问题', '质控警告', '整改闭环'], workflow: ['汇聚质量事实', '识别风险', '追踪整改', '复核趋势'], links: [{ label: '院科质控', to: '/department-qc' }, { label: '质量评级', to: '/quality-rating' }] },
};

export function metricWorkbench(id: MetricWorkbenchId) { return metricWorkbenches[id]; }
