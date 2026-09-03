<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import type { DeviceCatalogWire } from '../../generated/contracts';
import {
  createDevice,
  deactivateDevice,
  issueDeviceLease,
  listDevices,
  listDeviceStatuses,
} from '../../api/device';
import { toClinicalIssue } from '../clinical-error';
import AdminActionDialog from '../components/AdminActionDialog.vue';
import AdminConfirmDialog from '../components/AdminConfirmDialog.vue';
import ClinicalPageState from '../components/ClinicalPageState.vue';

const typeLabels: Record<DeviceCatalogWire['device_type'], string> = {
  MONITOR: '床旁监护仪', VENTILATOR: '呼吸机', INFUSION_PUMP: '输注泵', IMAGING: '影像设备', LAB_ANALYZER: '检验分析仪',
};
const statusTone: Record<DeviceCatalogWire['status'], string> = { ACTIVE: 'green', INACTIVE: 'gray' };

const createOpen = ref(false);
const deactivateOpen = ref(false);
const busy = ref('');
const notice = ref('');
const selected = ref<DeviceCatalogWire | null>(null);
const form = reactive({
  deviceCode: '', displayName: '', deviceType: 'MONITOR' as DeviceCatalogWire['device_type'],
  manufacturerModel: '', department: '', gateway: '', standardInterface: '',
  calibrationDue: '', clockOffsetSeconds: 0, bindingPolicy: '',
});

const leaseQuery = useQuery({
  queryKey: ['devices', 'lease'], queryFn: issueDeviceLease,
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const devicesQuery = useQuery({
  queryKey: ['devices', 'catalog'],
  queryFn: () => listDevices(leaseQuery.data.value!),
  enabled: () => Boolean(leaseQuery.data.value), retry: false,
});
const statusesQuery = useQuery({
  queryKey: ['devices', 'statuses'],
  queryFn: () => listDeviceStatuses(leaseQuery.data.value!),
  enabled: () => Boolean(leaseQuery.data.value), retry: false,
});

const devices = computed(() => devicesQuery.data.value ?? []);
const statusByCode = computed(() => new Map((statusesQuery.data.value ?? []).map((item) => [item.device_code, item])));
const issue = computed(() => {
  const error = leaseQuery.error.value ?? devicesQuery.error.value ?? statusesQuery.error.value;
  return error ? toClinicalIssue(error) : null;
});

function openCreate() {
  form.deviceCode = ''; form.displayName = ''; form.deviceType = 'MONITOR';
  form.manufacturerModel = ''; form.department = ''; form.gateway = '';
  form.standardInterface = ''; form.calibrationDue = ''; form.clockOffsetSeconds = 0; form.bindingPolicy = '';
  createOpen.value = true;
}

function requestDeactivate(device: DeviceCatalogWire) {
  selected.value = device;
  deactivateOpen.value = true;
}

async function create() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || !form.deviceCode.trim() || !form.displayName.trim()) return;
  busy.value = 'create'; notice.value = '';
  try {
    await createDevice(lease, {
      device_code: form.deviceCode.trim(), display_name: form.displayName.trim(),
      device_type: form.deviceType,
      manufacturer_model: form.manufacturerModel.trim() || null,
      department: form.department.trim() || null,
      gateway: form.gateway.trim() || null,
      standard_interface: form.standardInterface.trim() || null,
      calibration_due: form.calibrationDue || null,
      clock_offset_seconds: form.clockOffsetSeconds,
      binding_policy: form.bindingPolicy.trim() || null,
    });
    notice.value = '设备已登记，编码不可覆盖修改。';
    createOpen.value = false;
    await devicesQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error);
    notice.value = `${next.code}：${next.message}`;
  } finally {
    busy.value = '';
  }
}

async function deactivate() {
  const lease = leaseQuery.data.value;
  if (!lease || !selected.value || busy.value) return;
  busy.value = 'deactivate'; notice.value = '';
  try {
    await deactivateDevice(lease, selected.value.device_id);
    notice.value = `${selected.value.display_name} 已停用。`;
    deactivateOpen.value = false;
    await devicesQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error);
    notice.value = `${next.code}：${next.message}`;
  } finally {
    busy.value = '';
  }
}

function formatDate(value: string | null | undefined): string {
  return value ?? '—';
}
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page">
    <div class="page-heading admin-heading">
      <div>
        <p class="eyebrow">数据中心 / 设备接入</p>
        <h1>医疗设备目录与接入状态</h1>
        <p>设备身份、责任科室、网关、校准与时钟质量统一维护；仅活动设备可接入遥测并进入临床视图。</p>
      </div>
      <div class="toolbar-actions">
        <RouterLink class="button secondary" to="/device-monitoring">设备监测与告警</RouterLink>
        <button class="button primary" @click="openCreate">新建设备</button>
      </div>
    </div>

    <ClinicalPageState v-if="leaseQuery.isPending.value" kind="loading" message="正在读取设备目录" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="devicesQuery.refetch()" />
    <template v-else>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>

      <section class="admin-metrics" aria-label="设备目录指标">
        <article><span>设备总数</span><strong>{{ devices.length }}</strong><small>已登记</small></article>
        <article><span>活动设备</span><strong>{{ devices.filter((item) => item.status === 'ACTIVE').length }}</strong><small>可接入遥测</small></article>
        <article><span>在线</span><strong>{{ [...statusByCode.values()].filter((item) => item.online_status === 'ONLINE').length }}</strong><small>有遥测状态</small></article>
        <article><span>告警</span><strong>{{ [...statusByCode.values()].filter((item) => item.alarm_state !== 'NONE').length }}</strong><small>中/高级</small></article>
      </section>

      <section class="admin-panel">
        <header><div><h2>设备台账</h2><p>设备编码与类型一经登记不可覆盖修改；停用保留历史遥测证据。</p></div></header>
        <div v-if="devices.length === 0" class="admin-empty">暂无设备，点击「新建设备」登记设备身份。</div>
        <div v-else class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>编码 / 名称</th><th>类型</th><th>责任科室</th><th>网关</th><th>校准到期</th><th>时钟</th><th>运行状态</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="device in devices" :key="device.device_id">
                <td><strong>{{ device.display_name }}</strong><small><code>{{ device.device_code }}</code></small></td>
                <td>{{ typeLabels[device.device_type] }}</td>
                <td>{{ device.department ?? '—' }}</td>
                <td>{{ device.gateway ?? '—' }}</td>
                <td>{{ formatDate(device.calibration_due) }}</td>
                <td>{{ device.clock_offset_seconds }}s</td>
                <td>
                  <span v-if="statusByCode.get(device.device_code)" class="admin-status" :class="statusByCode.get(device.device_code)!.online_status === 'ONLINE' ? 'green' : statusByCode.get(device.device_code)!.online_status === 'DEGRADED' ? 'amber' : 'red'">
                    {{ statusByCode.get(device.device_code)!.online_status === 'ONLINE' ? '在线' : statusByCode.get(device.device_code)!.online_status === 'DEGRADED' ? '降级' : '离线' }}
                  </span>
                  <span v-else class="admin-status gray">未采集</span>
                </td>
                <td><span class="admin-status" :class="statusTone[device.status]">{{ device.status === 'ACTIVE' ? '活动' : '停用' }}</span></td>
                <td>
                  <RouterLink v-if="device.status === 'ACTIVE'" class="task-action" :to="`/device-monitoring/${device.device_code}`">详情</RouterLink>
                  <button v-if="device.status === 'ACTIVE'" class="task-action danger" :disabled="Boolean(busy)" @click="requestDeactivate(device)">停用</button>
                  <span v-else>—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <AdminActionDialog v-model:open="createOpen" title="新建设备" description="设备编码创建后不可覆盖修改；校准到期与时钟偏移超过 30 秒将进入人工复核。">
      <form class="admin-form" @submit.prevent="create">
        <label><span>设备编码</span><input v-model="form.deviceCode" maxlength="128" required /></label>
        <label><span>显示名</span><input v-model="form.displayName" maxlength="256" required /></label>
        <label><span>设备类型</span>
          <select v-model="form.deviceType"><option v-for="(label, value) in typeLabels" :key="value" :value="value">{{ label }}</option></select>
        </label>
        <label><span>厂商 / 型号</span><input v-model="form.manufacturerModel" /></label>
        <label><span>责任科室</span><input v-model="form.department" /></label>
        <label><span>接入网关</span><input v-model="form.gateway" /></label>
        <label><span>标准接口</span><input v-model="form.standardInterface" /></label>
        <label><span>下次校准</span><input v-model="form.calibrationDue" type="date" /></label>
        <label><span>时钟偏移秒数</span><input v-model.number="form.clockOffsetSeconds" type="number" /></label>
        <label><span>患者绑定策略</span><textarea v-model="form.bindingPolicy" /></label>
      </form>
      <template #footer="{ close }"><button class="button secondary" @click="close">取消</button><button class="button primary" :disabled="Boolean(busy)" @click="create">登记</button></template>
    </AdminActionDialog>

    <AdminConfirmDialog v-model:open="deactivateOpen" title="停用设备" :description="`停用 ${selected?.display_name ?? '设备'} 后新遥测不再进入临床视图，历史观测与状态证据保留。`" confirm-label="确认停用" :busy="Boolean(busy)" @confirm="deactivate" />
  </section>
</template>
