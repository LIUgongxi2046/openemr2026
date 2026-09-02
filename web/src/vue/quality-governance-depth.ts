import type { QualityGovernanceKind, QualityGovernanceModule } from '../api/quality-governance';
import type { QualityOperationModuleId } from './quality-operations';

export type QualityGovernanceDepthModuleId = QualityOperationModuleId | 'archive-assets';

export interface QualityGovernanceDepthDefinition {
  moduleId: QualityGovernanceDepthModuleId;
  moduleCode: QualityGovernanceModule;
  title: string;
  collectionPath: string;
  parentLabel: string;
  chinaPolicyOptions: readonly string[];
}

export const qualityGovernanceDepthDefinitions: Record<QualityGovernanceDepthModuleId, QualityGovernanceDepthDefinition> = {
  'quality-center': {
    moduleId: 'quality-center', moduleCode: 'QUALITY_CENTER', title: '质量改进项目',
    collectionPath: '/quality-center/initiatives', parentLabel: '改进项目',
    chinaPolicyOptions: ['医疗质量管理办法', '医疗质量安全核心制度要点', '院级医疗质量安全管理制度'],
  },
  'department-qc': {
    moduleId: 'department-qc', moduleCode: 'DEPARTMENT_QC', title: '院科质控缺陷',
    collectionPath: '/department-qc/cases', parentLabel: '质控缺陷',
    chinaPolicyOptions: ['三级查房制度', '疑难病例讨论制度', '会诊制度', '危急值报告制度', '病历管理制度'],
  },
  'quality-rating': {
    moduleId: 'quality-rating', moduleCode: 'QUALITY_RATING', title: '评级取证项目',
    collectionPath: '/quality-rating/assessments', parentLabel: '评级项目',
    chinaPolicyOptions: ['电子病历系统应用水平分级评价标准（试行）', '电子病历 39 项评价项目', '四维评价：功能、应用范围、数据质量、实效'],
  },
  'infection-events': {
    moduleId: 'infection-events', moduleCode: 'INFECTION_EVENTS', title: '院感事件',
    collectionPath: '/infection-events/clues', parentLabel: '院感线索',
    chinaPolicyOptions: ['医院感染管理办法', '医院感染暴发报告及处置管理规范', '传染病信息报告管理规范'],
  },
  credentials: {
    moduleId: 'credentials', moduleCode: 'CREDENTIALS', title: '临床资质授权',
    collectionPath: '/credentials/grants', parentLabel: '资质授权',
    chinaPolicyOptions: ['医师法与医师执业注册管理', '手术分级管理制度', '抗菌药物临床应用分级管理', '麻醉药品和精神药品处方权管理'],
  },
  'archive-assets': {
    moduleId: 'archive-assets', moduleCode: 'ARCHIVE_ASSET', title: '病案资产治理',
    collectionPath: '/archive-assets', parentLabel: '病案资产',
    chinaPolicyOptions: ['医疗机构病历管理规定（2013年版）', '电子病历系统功能应用水平分级评价', '个人信息保护法与数据最小必要', '院级病案归档、借阅、复制与长期保存制度'],
  },
};

export const qualityGovernanceKindByLevel: Record<number, QualityGovernanceKind> = {
  5: 'ACTION', 6: 'EVIDENCE', 7: 'REVIEW',
};

export const qualityGovernanceLevelLabel: Record<number, string> = {
  5: 'L5 整改动作', 6: 'L6 证据束', 7: 'L7 复核与 Agent',
};
