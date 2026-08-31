<script setup lang="ts">
import DataCenterConfigurationCatalog from '../components/DataCenterConfigurationCatalog.vue';

const definition = {
  configType: 'DEVICE_CATALOG', eyebrow: '数据中心 / 设备接入', title: '设备目录、网关与可信绑定',
  subtitle: '统一维护设备身份、责任科室、网关、校准、时钟质量和患者绑定策略；仅已发布且可信的设备数据可进入临床视图。',
  createLabel: '新建设备', itemLabel: '设备',
  links: [{ label: '进入设备监测与告警', to: '/device-monitoring' }],
  fields: [
    { key: 'device_type', label: '设备类型', kind: 'select', defaultValue: 'MONITOR', options: [{ label: '床旁监护仪', value: 'MONITOR' }, { label: '呼吸机', value: 'VENTILATOR' }, { label: '输注泵', value: 'INFUSION_PUMP' }, { label: '影像设备', value: 'IMAGING' }, { label: '检验分析仪', value: 'LAB_ANALYZER' }] },
    { key: 'manufacturer_model', label: '厂商 / 型号', placeholder: '例：迈瑞 BeneVision N15' },
    { key: 'department', label: '责任科室', placeholder: '例：心血管内科一病区' },
    { key: 'gateway', label: '接入网关', placeholder: '例：GW-BEDSIDE-01 / VLAN-MED-12' },
    { key: 'standard_interface', label: '标准接口', placeholder: '例：IEEE 11073 / HL7 ORU' },
    { key: 'calibration_due', label: '下次校准', placeholder: '例：2027-02-28' },
    { key: 'clock_offset_seconds', label: '时钟偏移秒数', kind: 'number', defaultValue: '0' },
    { key: 'binding_policy', label: '患者绑定策略', kind: 'textarea', placeholder: '例：腕带 + 床位双标识，解绑需责任护士确认' },
  ],
  safeguards: ['未绑定患者的数据不得进入患者视图', '时钟偏移超过 30 秒进入人工复核', '校准到期设备停止产生可签署临床事实', '解绑和重绑必须保留责任人与时间证据'],
} as const;
</script>

<template><DataCenterConfigurationCatalog :definition="definition" /></template>
