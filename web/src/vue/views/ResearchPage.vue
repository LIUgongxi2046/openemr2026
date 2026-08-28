<script setup lang="ts">
import DataCenterConfigurationCatalog from '../components/DataCenterConfigurationCatalog.vue';

const definition = {
  configType: 'RESEARCH_PROJECT', eyebrow: '数据中心 / 科研统计', title: '科研项目与统计中心',
  subtitle: '病历数据利用绑定项目、科学性审查、伦理批件、批准用途和有效期；默认只展示去标识聚合。',
  createLabel: '新建项目申请', itemLabel: '科研项目',
  links: [
    { label: '队列构建', to: '/cohort-builder' },
    { label: '统计分析', to: '/research-stats' },
    { label: '数据交付', to: '/research-dataset' },
  ],
  fields: [
    { key: 'project_type', label: '项目类型', kind: 'select', defaultValue: 'OBSERVATIONAL', options: [{ label: '观察性研究', value: 'OBSERVATIONAL' }, { label: '回顾性研究', value: 'RETROSPECTIVE' }, { label: '干预性研究', value: 'INTERVENTIONAL' }] },
    { key: 'principal_investigator', label: '主要研究者', placeholder: '例：周教授' },
    { key: 'registry_number', label: '统一登记号', placeholder: '例：MRR-2026-001842' },
    { key: 'ethics_approval', label: '伦理批件', placeholder: '例：IRB-2026-119' },
    { key: 'approved_purpose', label: '批准用途', kind: 'textarea', placeholder: '描述唯一、具体的数据使用目的' },
    { key: 'data_scope', label: '批准数据范围', kind: 'list', placeholder: '例：门诊病历、处方、检验' },
    { key: 'member_count', label: '项目成员数', kind: 'number', defaultValue: '1' },
    { key: 'expires_at', label: '有效期至', placeholder: '例：2027-07-31' },
  ],
  safeguards: ['项目用途、伦理批件与数据范围三者必须一致', '项目到期立即停止新的数据访问', '患者级数据必须另行申请并加追踪水印', '研究衍生变量不得回写原始临床事实'],
} as const;
</script>

<template><DataCenterConfigurationCatalog :definition="definition" /></template>
