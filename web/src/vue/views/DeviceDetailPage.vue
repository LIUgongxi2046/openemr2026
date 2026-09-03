<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import type { DeviceStatusWire } from '../../generated/contracts';
import { issueDeviceLease, listDeviceStatuses, listDeviceTelemetry } from '../../api/device';
import { toClinicalIssue } from '../clinical-error';
import ClinicalPageState from '../components/ClinicalPageState.vue';

const route = useRoute();
const deviceCode = computed(() => String(route.params.deviceCode ?? ''));
const metricLabels: Record<string, string> = {
  HR: '心率', SpO2: '血氧饱和度', NIBP_SYS: '收缩压', NIBP_DIA: '舒张压',
  RESP: '呼吸频率', TEMP: '体温', ETCO2: '呼气末二氧化碳',
};

const leaseQuery = useQuery({
  queryKey: ['device-detail', 'lease'], queryFn: issueDeviceLease,
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const statusesQuery = useQuery({
  queryKey: ['device-detail', 'status', deviceCode],
  queryFn: () => listDeviceStatuses(leaseQuery.data.value!, deviceCode.value),
  enabled: () => Boolean(leaseQuery.data.value), retry: false,
});
const observationsQuery = useQuery({
  queryKey: ['device-detail', 'observations', deviceCode],
  queryFn: () => listDeviceTelemetry(leaseQuery.data.value!, deviceCode.value),
  enabled: () => Boolean(leaseQuery.data.value), retry: false,
});

const status = computed<DeviceStatusWire | null>(() => statusesQuery.data.value?.[0] ?? null);
const observations = computed(() => observationsQuery.data.value ?? []);
const issue = computed(() => {
  const error = leaseQuery.error.value ?? statusesQuery.error.value ?? observationsQuery.error.value;
  return error ? toClinicalIssue(error) : null;
});

function formatDate(value: string | null | undefined): string {
  return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(value)) : '—';
}
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page">
    <div class="page-heading admin-heading">
      <div>
        <p class="eyebrow">数据中心 / 设备接入 / 设备详情</p>
        <h1>设备遥测详情</h1>
        <p>{{ deviceCode }} · 观测记录与运行状态只读展示。</p>
      </div>
      <div class="toolbar-actions"><RouterLink class="button secondary" to="/device-monitoring">返回设备监测</RouterLink></div>
    </div>

    <ClinicalPageState v-if="leaseQuery.isPending.value || observationsQuery.isPending.value" kind="loading" message="正在读取设备遥测详情" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="observationsQuery.refetch()" />
    <template v-else>
      <section v-if="status" class="admin-metrics">
        <article><span>在线状态</span><strong>{{ status.online_status }}</strong><small>最近观测 {{ formatDate(status.last_observed_at) }}</small></article>
        <article><span>时钟偏差</span><strong>{{ status.clock_offset_seconds }}s</strong><small>超过 30s 进入人工复核</small></article>
        <article><span>校准状态</span><strong>{{ status.calibration_status === 'VALID' ? '正常' : '待复核' }}</strong><small>由设备网关上报</small></article>
        <article><span>告警状态</span><strong>{{ status.alarm_state === 'NONE' ? '无' : status.alarm_state }}</strong><small>最高级告警</small></article>
      </section>

      <section class="admin-panel">
        <header><div><h2>观测记录</h2><p>按观测时间倒序，遥测值与质量等级由设备网关生成。</p></div></header>
        <div v-if="observations.length === 0" class="admin-empty">该设备暂无遥测记录。</div>
        <div v-else class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>指标</th><th>数值</th><th>单位</th><th>质量</th><th>告警</th><th>观测时间</th></tr></thead>
            <tbody>
              <tr v-for="item in observations" :key="item.observation_id">
                <td>{{ metricLabels[item.metric] ?? item.metric }}</td>
                <td>{{ item.metric_value }}</td>
                <td>{{ item.metric_unit }}</td>
                <td><span class="admin-status" :class="item.quality === 'VERIFIED' ? 'green' : 'amber'">{{ item.quality === 'VERIFIED' ? '已核验' : '可疑' }}</span></td>
                <td><span class="admin-status" :class="item.alarm_level === 'NONE' ? 'green' : item.alarm_level === 'MEDIUM' ? 'amber' : 'red'">{{ item.alarm_level === 'NONE' ? '无' : item.alarm_level }}</span></td>
                <td>{{ formatDate(item.observed_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </section>
</template>
