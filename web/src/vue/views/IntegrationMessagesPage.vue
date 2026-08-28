<script setup lang="ts">
import DataCenterConfigurationCatalog from '../components/DataCenterConfigurationCatalog.vue';

const definition = {
  configType: 'INTEGRATION_INCIDENT', eyebrow: '数据中心 / 集成平台', title: '集成消息追踪与业务对账',
  subtitle: '消息成功、转换成功和临床业务入账是不同状态；差异工单直接影响重试、隔离和人工降级流程。',
  createLabel: '创建差异工单', itemLabel: '差异工单',
  fields: [
    { key: 'trace_id', label: 'Trace', placeholder: '例：TR-882177' },
    { key: 'direction', label: '方向', kind: 'select', defaultValue: 'EMR_TO_PACS', options: [{ label: 'LIS → EMR', value: 'LIS_TO_EMR' }, { label: 'EMR → PACS', value: 'EMR_TO_PACS' }, { label: 'EMR → 区域平台', value: 'EMR_TO_HIE' }, { label: 'HIS → EMR', value: 'HIS_TO_EMR' }] },
    { key: 'event_type', label: '协议 / 事件', placeholder: '例：WADO-RS' },
    { key: 'business_object', label: '业务对象', placeholder: '例：Study 8821' },
    { key: 'result', label: '当前结果', kind: 'select', defaultValue: 'TIMEOUT', options: [{ label: '超时', value: 'TIMEOUT' }, { label: '待回执', value: 'PENDING_ACK' }, { label: '业务不一致', value: 'RECONCILIATION_FAILED' }, { label: '已恢复', value: 'RECOVERED' }] },
    { key: 'latency', label: '耗时', placeholder: '例：5.0s' },
    { key: 'clinical_impact', label: '临床影响', kind: 'textarea', placeholder: '说明报告、图像、签名或共享状态受何影响' },
    { key: 'retry_policy', label: '重试 / 人工策略', kind: 'textarea', placeholder: '说明幂等键、父 Trace、重试次数和人工兜底' },
  ],
  safeguards: ['消息正文在页面和导出中均需脱敏', '相同业务键重试不得产生重复副作用', '死信只能由授权人员重放', '停用工单表示处置闭环，不删除原 Trace 和业务对象'],
} as const;
</script>

<template><DataCenterConfigurationCatalog :definition="definition" /></template>
