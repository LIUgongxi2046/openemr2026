<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import type { HistoricalMigrationBatchWire, SourceSystemInventoryWire } from '../../generated/contracts';
import {
  activateSourceSystem, configureSourceSystem, deactivateSourceFieldMapping, issueGovernanceLease,
  listHistoricalMigrationBatches, listHistoricalMigrationCheckpoints, listSourceFieldMappings,
  listSourcePatientMatchCandidates, listSourceSystems, reconcileHistoricalMigrationBatch,
  recordHistoricalMigrationCheckpoint, recordSourcePatientMatchCandidate, registerSourceFieldMapping,
  registerSourceSystem, resolveSourcePatientMatchCandidate, retireSourceSystem, rollbackHistoricalMigrationBatch,
  startHistoricalMigrationBatch, switchHistoricalMigrationBatch,
} from '../../api/governance';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const leaseQuery = useQuery({
  queryKey: ['governance', 'migration', 'lease'],
  queryFn: () => issueGovernanceLease('MIGRATION_ADMIN'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const sourcesQuery = useQuery({
  queryKey: ['governance', 'migration', 'sources'],
  queryFn: () => listSourceSystems(leaseQuery.data.value!),
  enabled: () => Boolean(leaseQuery.data.value), retry: false,
});
const batchesQuery = useQuery({
  queryKey: ['governance', 'migration', 'batches'],
  queryFn: () => listHistoricalMigrationBatches(leaseQuery.data.value!),
  enabled: () => Boolean(leaseQuery.data.value), retry: false,
});
const selectedSourceId = ref('');
const selectedBatchId = ref('');
const candidatesQuery = useQuery({
  queryKey: ['governance', 'migration', 'candidates', selectedSourceId],
  queryFn: () => listSourcePatientMatchCandidates(leaseQuery.data.value!, selectedSourceId.value),
  enabled: () => Boolean(leaseQuery.data.value && selectedSourceId.value), retry: false,
});
const issue = computed(() => (leaseQuery.error.value ?? sourcesQuery.error.value ?? batchesQuery.error.value)
  ? toClinicalIssue(leaseQuery.error.value ?? sourcesQuery.error.value ?? batchesQuery.error.value) : null);

const sources = computed(() => sourcesQuery.data.value ?? []);
const batches = computed(() => batchesQuery.data.value ?? []);
const candidates = computed(() => candidatesQuery.data.value ?? []);

const mappingsQuery = useQuery({
  queryKey: ['governance', 'migration', 'mappings', selectedSourceId],
  queryFn: () => listSourceFieldMappings(leaseQuery.data.value!, selectedSourceId.value),
  enabled: () => Boolean(leaseQuery.data.value && selectedSourceId.value), retry: false,
});
const checkpointsQuery = useQuery({
  queryKey: ['governance', 'migration', 'checkpoints', selectedBatchId],
  queryFn: () => listHistoricalMigrationCheckpoints(leaseQuery.data.value!, selectedBatchId.value),
  enabled: () => Boolean(leaseQuery.data.value && selectedBatchId.value), retry: false,
});
const mappings = computed(() => mappingsQuery.data.value ?? []);
const checkpoints = computed(() => checkpointsQuery.data.value ?? []);

const sourceForm = reactive({ sourceCode: '', displayName: '', systemType: 'EMR' });
const mappingForm = reactive({ sourceField: '', targetEntity: '', targetField: '' });
const candidateForm = reactive({ sourcePatientIdentifier: '', displayName: '', sexCode: 'M', birthDate: '' });
const batchForm = reactive({ sourceSystem: '', recordCount: 0 });
const checkpointForm = reactive({ processedRecords: 0, lastSourceKey: '' });
const busy = ref('');
const notice = ref('');

function statusLabel(s: string) {
  const map: Record<string, string> = { REGISTERED: '已注册', CONFIGURED: '已配置', ACTIVE: '激活', RETIRED: '已退休', TRIAL: '试迁', RECONCILED: '已对账', SWITCHED: '已切换', ROLLED_BACK: '已回退', PENDING: '待复核' };
  return map[s] ?? s;
}

async function createSource() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || !sourceForm.sourceCode.trim() || !sourceForm.displayName.trim()) return;
  busy.value = 'source'; notice.value = '';
  try {
    await registerSourceSystem(lease, {
      source_code: sourceForm.sourceCode.trim(), display_name: sourceForm.displayName.trim(),
      system_type: sourceForm.systemType as 'EMR', registered_at: new Date().toISOString(),
    });
    sourceForm.sourceCode = ''; sourceForm.displayName = '';
    notice.value = '源系统已注册。'; await sourcesQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

async function transitionSource(source: SourceSystemInventoryWire, action: 'configure' | 'activate' | 'retire') {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value) return;
  busy.value = source.source_system_id; notice.value = '';
  try {
    if (action === 'configure') await configureSourceSystem(lease, source);
    else if (action === 'activate') await activateSourceSystem(lease, source);
    else await retireSourceSystem(lease, source);
    notice.value = `源系统 ${source.display_name} 状态已推进。`; await sourcesQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

async function createMapping() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || !selectedSourceId.value || !mappingForm.sourceField.trim() || !mappingForm.targetEntity.trim() || !mappingForm.targetField.trim()) return;
  busy.value = 'mapping'; notice.value = '';
  try {
    await registerSourceFieldMapping(lease, {
      source_system_id: selectedSourceId.value, source_field: mappingForm.sourceField.trim(),
      target_entity: mappingForm.targetEntity.trim(), target_field: mappingForm.targetField.trim(),
      registered_at: new Date().toISOString(),
    });
    mappingForm.sourceField = ''; mappingForm.targetEntity = ''; mappingForm.targetField = '';
    notice.value = '源字段映射已登记。'; await mappingsQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

async function createCandidate() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || !selectedSourceId.value || !candidateForm.sourcePatientIdentifier.trim() || !candidateForm.displayName.trim() || !candidateForm.birthDate) return;
  busy.value = 'candidate'; notice.value = '';
  try {
    await recordSourcePatientMatchCandidate(lease, {
      source_system_id: selectedSourceId.value, source_patient_identifier: candidateForm.sourcePatientIdentifier.trim(),
      display_name: candidateForm.displayName.trim(), sex_code: candidateForm.sexCode, birth_date: candidateForm.birthDate,
    });
    candidateForm.sourcePatientIdentifier = ''; candidateForm.displayName = '';
    notice.value = '迁移源患者候选已登记。'; await candidatesQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

async function createBatch() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || !batchForm.sourceSystem.trim() || batchForm.recordCount <= 0) return;
  busy.value = 'batch'; notice.value = '';
  try {
    await startHistoricalMigrationBatch(lease, {
      source_system: batchForm.sourceSystem.trim(), record_count: batchForm.recordCount, started_at: new Date().toISOString(),
    });
    batchForm.sourceSystem = ''; batchForm.recordCount = 0;
    notice.value = '历史迁移批次已开始。'; await batchesQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

async function transitionBatch(batch: HistoricalMigrationBatchWire, action: 'reconcile' | 'switch' | 'rollback') {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value) return;
  busy.value = batch.batch_id; notice.value = '';
  try {
    if (action === 'reconcile') await reconcileHistoricalMigrationBatch(lease, batch, 0);
    else if (action === 'switch') await switchHistoricalMigrationBatch(lease, batch);
    else await rollbackHistoricalMigrationBatch(lease, batch);
    notice.value = `批次 ${batch.source_system} 状态已推进。`; await batchesQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

async function createCheckpoint() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || !selectedBatchId.value || checkpointForm.processedRecords < 0) return;
  busy.value = 'checkpoint'; notice.value = '';
  try {
    await recordHistoricalMigrationCheckpoint(lease, {
      batch_id: selectedBatchId.value, processed_records: checkpointForm.processedRecords,
      last_source_key: checkpointForm.lastSourceKey.trim() || null, checkpointed_at: new Date().toISOString(),
    });
    checkpointForm.processedRecords = 0; checkpointForm.lastSourceKey = '';
    notice.value = '断点已记录。'; await checkpointsQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page">
    <div class="page-heading admin-heading">
      <div><p class="eyebrow">数据中心 / 历史迁移</p><h1>历史迁移与切换</h1><p>源系统盘点、字段映射、患者匹配与断点重跑；切换须对账一致，进度单调可续迁。</p></div>
    </div>

    <ClinicalPageState v-if="leaseQuery.isPending.value || sourcesQuery.isPending.value" kind="loading" message="正在读取迁移上下文" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="sourcesQuery.refetch()" />
    <template v-else>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>

      <section class="admin-panel">
        <header><div><h2>源系统盘点</h2><p>编码唯一，生命周期 已注册→已配置→激活→退休。</p></div>
          <form class="admin-inline-form" @submit.prevent="createSource">
            <input v-model="sourceForm.sourceCode" maxlength="96" required placeholder="源编码" />
            <input v-model="sourceForm.displayName" maxlength="256" required placeholder="显示名" />
            <select v-model="sourceForm.systemType" aria-label="源系统类型"><option value="EMR">EMR</option><option value="LIS">LIS</option><option value="PACS">PACS</option><option value="PHARMACY">PHARMACY</option><option value="BILLING">BILLING</option><option value="OTHER">OTHER</option></select>
            <button class="button primary" :disabled="Boolean(busy)">注册</button>
          </form>
        </header>
        <div v-if="sources.length === 0" class="admin-empty">暂无源系统。</div>
        <div v-else class="admin-table-wrap"><table class="admin-table"><thead><tr><th>编码 / 名称</th><th>类型</th><th>状态</th><th>操作</th></tr></thead><tbody>
          <tr v-for="source in sources" :key="source.source_system_id">
            <td><button class="link-button" @click="selectedSourceId = source.source_system_id"><strong>{{ source.display_name }}</strong><small><code>{{ source.source_code }}</code></small></button></td>
            <td>{{ source.system_type }}</td>
            <td><span class="admin-status" :class="source.connection_status.toLowerCase()">{{ statusLabel(source.connection_status) }}</span></td>
            <td>
              <button v-if="source.connection_status === 'REGISTERED'" class="task-action" :disabled="Boolean(busy)" @click="transitionSource(source, 'configure')">配置</button>
              <button v-else-if="source.connection_status === 'CONFIGURED'" class="task-action" :disabled="Boolean(busy)" @click="transitionSource(source, 'activate')">激活</button>
              <button v-else-if="source.connection_status === 'ACTIVE'" class="task-action danger" :disabled="Boolean(busy)" @click="transitionSource(source, 'retire')">退休</button>
              <span v-else>—</span>
            </td>
          </tr>
        </tbody></table></div>
      </section>

      <section class="admin-panel" v-if="selectedSourceId">
        <header><div><h2>源字段映射</h2><p>仅已配置/激活源可登记，映射唯一。</p></div>
          <form class="admin-inline-form" @submit.prevent="createMapping">
            <input v-model="mappingForm.sourceField" maxlength="128" required placeholder="源字段" />
            <input v-model="mappingForm.targetEntity" maxlength="128" required placeholder="目标实体" />
            <input v-model="mappingForm.targetField" maxlength="128" required placeholder="目标字段" />
            <button class="button primary" :disabled="Boolean(busy)">登记</button>
          </form>
        </header>
        <div v-if="mappings.length === 0" class="admin-empty">该源暂无字段映射。</div>
        <div v-else class="admin-table-wrap"><table class="admin-table"><thead><tr><th>源字段</th><th>目标实体</th><th>目标字段</th><th>状态</th><th>操作</th></tr></thead><tbody>
          <tr v-for="mapping in mappings" :key="mapping.mapping_id">
            <td><code>{{ mapping.source_field }}</code></td><td>{{ mapping.target_entity }}</td><td><code>{{ mapping.target_field }}</code></td>
            <td><span class="admin-status" :class="mapping.status.toLowerCase()">{{ mapping.status === 'ACTIVE' ? '有效' : '已停用' }}</span></td>
            <td><button class="task-action" :disabled="mapping.status !== 'ACTIVE' || Boolean(busy)" @click="async () => { busy = mapping.mapping_id; try { await deactivateSourceFieldMapping(leaseQuery.data.value!, mapping); await mappingsQuery.refetch(); } catch (error) { notice = `${toClinicalIssue(error).code}：${toClinicalIssue(error).message}`; } finally { busy = ''; } }">停用</button></td>
          </tr>
        </tbody></table></div>

        <header style="margin-top:16px"><div><h2>迁移源患者匹配</h2><p>确定性匹配评分，复核后决议。</p></div>
          <form class="admin-inline-form" @submit.prevent="createCandidate">
            <input v-model="candidateForm.sourcePatientIdentifier" maxlength="128" required placeholder="源患者标识" />
            <input v-model="candidateForm.displayName" maxlength="256" required placeholder="姓名" />
            <select v-model="candidateForm.sexCode" aria-label="迁移源患者性别"><option value="M">男</option><option value="F">女</option></select>
            <input v-model="candidateForm.birthDate" type="date" required />
            <button class="button primary" :disabled="Boolean(busy)">登记</button>
          </form>
        </header>
        <div v-if="candidates.length === 0" class="admin-empty">暂无患者匹配候选。</div>
        <div v-else class="admin-table-wrap"><table class="admin-table"><thead><tr><th>源标识</th><th>姓名</th><th>匹配分</th><th>复核状态</th><th>操作</th></tr></thead><tbody>
          <tr v-for="candidate in candidates" :key="candidate.candidate_id">
            <td><code>{{ candidate.source_patient_identifier }}</code></td>
            <td>{{ candidate.display_name }}</td>
            <td>{{ candidate.match_score }}</td>
            <td><span class="admin-status" :class="candidate.review_status.toLowerCase()">{{ statusLabel(candidate.review_status) }}</span></td>
            <td><button v-if="candidate.review_status === 'PENDING'" class="task-action" :disabled="Boolean(busy)" @click="async () => { busy = candidate.candidate_id; try { await resolveSourcePatientMatchCandidate(leaseQuery.data.value!, candidate, null); await candidatesQuery.refetch(); } catch (error) { notice = `${toClinicalIssue(error).code}：${toClinicalIssue(error).message}`; } finally { busy = ''; } }">决议</button><span v-else>—</span></td>
          </tr>
        </tbody></table></div>
      </section>

      <section class="admin-panel">
        <header><div><h2>历史迁移批次</h2><p>试迁→对账→切换→回退；切换须差异数为 0。</p></div>
          <form class="admin-inline-form" @submit.prevent="createBatch">
            <input v-model="batchForm.sourceSystem" maxlength="128" required placeholder="源系统" />
            <input v-model.number="batchForm.recordCount" type="number" min="1" required placeholder="记录数" />
            <button class="button primary" :disabled="Boolean(busy)">开始试迁</button>
          </form>
        </header>
        <div v-if="batches.length === 0" class="admin-empty">暂无迁移批次。</div>
        <div v-else class="admin-table-wrap"><table class="admin-table"><thead><tr><th>源系统</th><th>记录数</th><th>差异数</th><th>状态</th><th>操作</th></tr></thead><tbody>
          <tr v-for="batch in batches" :key="batch.batch_id">
            <td><button class="link-button" @click="selectedBatchId = batch.batch_id"><strong>{{ batch.source_system }}</strong><small>…{{ batch.batch_id.slice(-8) }}</small></button></td>
            <td>{{ batch.record_count }}</td><td>{{ batch.mismatch_count }}</td>
            <td><span class="admin-status" :class="batch.batch_status.toLowerCase()">{{ statusLabel(batch.batch_status) }}</span></td>
            <td>
              <button v-if="batch.batch_status === 'TRIAL'" class="task-action" :disabled="Boolean(busy)" @click="transitionBatch(batch, 'reconcile')">对账</button>
              <button v-else-if="batch.batch_status === 'RECONCILED'" class="task-action" :disabled="Boolean(busy)" @click="transitionBatch(batch, 'switch')">切换</button>
              <button v-if="batch.batch_status === 'TRIAL' || batch.batch_status === 'RECONCILED'" class="task-action danger" :disabled="Boolean(busy)" @click="transitionBatch(batch, 'rollback')">回退</button>
              <span v-else>—</span>
            </td>
          </tr>
        </tbody></table></div>
      </section>

      <section class="admin-panel" v-if="selectedBatchId">
        <header><div><h2>断点重跑</h2><p>进度单调递增，可续迁批次记录检查点。</p></div>
          <form class="admin-inline-form" @submit.prevent="createCheckpoint">
            <input v-model.number="checkpointForm.processedRecords" type="number" min="0" required placeholder="已处理记录数" />
            <input v-model="checkpointForm.lastSourceKey" maxlength="256" placeholder="最后源键（可选）" />
            <button class="button primary" :disabled="Boolean(busy)">记录检查点</button>
          </form>
        </header>
        <div v-if="checkpoints.length === 0" class="admin-empty">该批次暂无检查点。</div>
        <div v-else class="admin-table-wrap"><table class="admin-table"><thead><tr><th>已处理记录数</th><th>最后源键</th><th>记录时间</th></tr></thead><tbody>
          <tr v-for="checkpoint in checkpoints" :key="checkpoint.checkpoint_id">
            <td>{{ checkpoint.processed_records }}</td><td><code>{{ checkpoint.last_source_key ?? '—' }}</code></td>
            <td>{{ new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(checkpoint.checkpointed_at)) }}</td>
          </tr>
        </tbody></table></div>
      </section>
    </template>
  </section>
</template>
