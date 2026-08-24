<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import { issueGovernanceLease, listSourceFieldMappings, listSourceSystems, registerSourceFieldMapping } from '../../api/governance';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const leaseQuery = useQuery({ queryKey: ['governance', 'integration', 'lease'], queryFn: () => issueGovernanceLease('INTEGRATION_MAPPING'), retry: false, staleTime: 5 * 60_000, gcTime: 0 });
const sourcesQuery = useQuery({ queryKey: ['governance', 'integration', 'sources'], queryFn: () => listSourceSystems(leaseQuery.data.value!), enabled: () => Boolean(leaseQuery.data.value), retry: false });
const sources = computed(() => sourcesQuery.data.value ?? []);
const selectedSourceId = ref('');
const mappingsQuery = useQuery({ queryKey: ['governance', 'integration', 'mappings', selectedSourceId], queryFn: () => listSourceFieldMappings(leaseQuery.data.value!, selectedSourceId.value), enabled: () => Boolean(leaseQuery.data.value && selectedSourceId.value), retry: false });
const issue = computed(() => (leaseQuery.error.value ?? sourcesQuery.error.value ?? mappingsQuery.error.value) ? toClinicalIssue(leaseQuery.error.value ?? sourcesQuery.error.value ?? mappingsQuery.error.value) : null);
const mappings = computed(() => mappingsQuery.data.value ?? []);
const form = reactive({ sourceField: '', targetEntity: '', targetField: '' });
const busy = ref(false);
const notice = ref('');

async function register() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || !selectedSourceId.value || !form.sourceField.trim() || !form.targetEntity.trim() || !form.targetField.trim()) return;
  busy.value = true; notice.value = '';
  try {
    await registerSourceFieldMapping(lease, { source_system_id: selectedSourceId.value, source_field: form.sourceField.trim(), target_entity: form.targetEntity.trim(), target_field: form.targetField.trim(), registered_at: new Date().toISOString() });
    form.sourceField = ''; form.targetEntity = ''; form.targetField = ''; notice.value = '源字段映射已登记。'; await mappingsQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = false; }
}
</script>

<template>
  <main id="main-content" class="content admin-content vue-native-page">
    <div class="page-heading admin-heading"><div><p class="eyebrow">配置中心 / 集成</p><h1>集成字段映射</h1><p>源系统字段到目标实体字段的映射登记；仅已配置/激活源可登记，映射唯一。</p></div></div>
    <ClinicalPageState v-if="leaseQuery.isPending.value || sourcesQuery.isPending.value" kind="loading" message="正在读取源系统" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="sourcesQuery.refetch()" />
    <template v-else>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>
      <div class="admin-layout">
        <section class="admin-panel"><header><div><h2>源系统</h2><p>选择源后查看映射。</p></div></header>
          <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>源系统</th><th>类型</th><th>状态</th></tr></thead><tbody>
            <tr v-for="source in sources" :key="source.source_system_id"><td><button class="link-button" @click="selectedSourceId = source.source_system_id"><strong>{{ source.display_name }}</strong><small><code>{{ source.source_code }}</code></small></button></td><td>{{ source.system_type }}</td><td><span class="admin-status">{{ source.connection_status }}</span></td></tr>
          </tbody></table></div>
          <div v-if="selectedSourceId" style="margin-top:14px"><header><div><h2>字段映射</h2><p>映射唯一。</p></div></header>
            <div v-if="!mappings.length" class="admin-empty">该源暂无字段映射。</div>
            <div v-else class="admin-table-wrap"><table class="admin-table"><thead><tr><th>源字段</th><th>目标实体</th><th>目标字段</th><th>状态</th></tr></thead><tbody>
              <tr v-for="mapping in mappings" :key="mapping.mapping_id"><td><code>{{ mapping.source_field }}</code></td><td>{{ mapping.target_entity }}</td><td><code>{{ mapping.target_field }}</code></td><td><span class="admin-status">{{ mapping.status }}</span></td></tr>
            </tbody></table></div>
          </div>
        </section>
        <section class="admin-panel admin-form-panel" v-if="selectedSourceId"><header><div><h2>登记映射</h2><p>源/目标字段必填。</p></div></header>
          <form class="admin-form" @submit.prevent="register">
            <label><span>源字段</span><input v-model="form.sourceField" required /></label>
            <label><span>目标实体</span><input v-model="form.targetEntity" required /></label>
            <label><span>目标字段</span><input v-model="form.targetField" required /></label>
            <button class="button primary full" :disabled="busy">登记</button>
          </form>
        </section>
      </div>
    </template>
  </main>
</template>
