<script setup lang="ts">
import DataCenterConfigurationCatalog from '../components/DataCenterConfigurationCatalog.vue';

const definition = {
  configType: 'INTEGRATION_CONNECTOR', eyebrow: '数据中心 / 集成平台', title: '连接器目录与能力卡',
  subtitle: '协议、能力、数据边界、认证、重试、熔断和版本明确声明；启停状态直接控制新消息是否进入该连接器。',
  createLabel: '创建连接器草稿', itemLabel: '连接器',
  fields: [
    { key: 'system_type', label: '系统类型', kind: 'select', defaultValue: 'LIS', options: [{ label: '检验 LIS', value: 'LIS' }, { label: '影像 PACS', value: 'PACS' }, { label: 'HIS / 费用', value: 'HIS' }, { label: '电子签名 CA', value: 'CA' }, { label: '区域平台 HIE', value: 'HIE' }] },
    { key: 'protocol', label: '协议与版本', placeholder: '例：HL7 v2.5.1 / FHIR R4' },
    { key: 'capabilities', label: '能力声明', kind: 'list', placeholder: '例：ADT、ORM、ORU' },
    { key: 'endpoint', label: '端点 / 网络', placeholder: '仅填写网络区或 Secret 引用' },
    { key: 'secret_reference', label: '秘密引用', placeholder: '例：file://secrets/integration/lis-prod' },
    { key: 'timeout_retry', label: '超时 / 重试', placeholder: '例：5s / 3 次 / 指数退避' },
    { key: 'circuit_breaker', label: '熔断与降级', placeholder: '例：60s / 人工降级' },
    { key: 'connector_version', label: '连接器版本', placeholder: '例：v3.2.1' },
  ],
  safeguards: ['凭据仅保存 Secret 引用且永不回显', '失败不得伪装为空结果', '写操作重试必须具备幂等业务键', '停用立即阻止新消息进入，历史 Trace 保留'],
} as const;
</script>

<template><DataCenterConfigurationCatalog :definition="definition" /></template>
