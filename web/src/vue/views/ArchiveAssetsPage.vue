<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import type { ArchiveCaseWire } from '../../generated/contracts';
import { createArchiveCase, createArchiveExport, issueArchiveLease, loadArchiveReadiness, transitionArchiveCase } from '../../clinical-api';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const busy = ref('');
const notice = ref('');
const reason = ref('病案管理复核完成');
const purpose = ref('病案复印与院内复核');
const archiveQuery = useQuery({
  queryKey: ['clinical', 'archive-readiness'],
  queryFn: async () => { const lease = await issueArchiveLease(); return { lease, readiness: await loadArchiveReadiness(lease) }; },
  retry: false, staleTime: 0, gcTime: 0,
});
const issue = computed(() => archiveQuery.error.value ? toClinicalIssue(archiveQuery.error.value) : null);
const readiness = computed(() => archiveQuery.data.value?.readiness);
const archiveCase = computed(() => readiness.value?.archive_case ?? null);

async function execute(label: string, action: (archive: ArchiveCaseWire | null) => Promise<void>) {
  if (busy.value || !archiveQuery.data.value) return;
  busy.value = label; notice.value = '';
  try { await action(archiveCase.value); await archiveQuery.refetch(); }
  catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}
function createCase() { const data = archiveQuery.data.value; if (!data) return; void execute('archive', async () => { await createArchiveCase(data.lease); notice.value = '不可变病案清单已生成'; }); }
function transition(action: 'seals' | 'unseals') { const data = archiveQuery.data.value; if (!data) return; void execute(action, async (current) => { if (current) await transitionArchiveCase(data.lease, current, action, reason.value); notice.value = action === 'seals' ? '病案已由独立岗位封存' : '病案已授权解封'; }); }
function createExport() { const data = archiveQuery.data.value; if (!data) return; void execute('export', async (current) => { if (current) await createArchiveExport(data.lease, current, purpose.value); notice.value = '独立可读导出包已固化'; }); }
function encounterLabel(value: string) { return ({ PLANNED: '计划中', IN_PROGRESS: '进行中', FINISHED: '已结束', CANCELLED: '已取消' } as Record<string, string>)[value] || value; }
function archiveStatusLabel(value: string) { return ({ ARCHIVED: '已归档待封存', SEALED: '已封存', UNSEALED: '授权解封中' } as Record<string, string>)[value] || value; }
function blockerLabel(value: string) { return ({ ENCOUNTER_NOT_FINISHED: '就诊尚未结束', ARCHIVE_DOCUMENT_REQUIRED: '缺少可归档病历', DOCUMENT_NOT_SIGNED: '当前版本未签署', DOCUMENT_QUALITY_NOT_PASSED: '当前内容质控未通过', SIGNATURE_EVIDENCE_REQUIRED: '缺少签名证据', SIGNATURE_EVIDENCE_NOT_VALID: '签名证据无效或待补齐' } as Record<string, string>)[value] || value; }
function eventLabel(value: string) { return ({ ARCHIVED: '形成归档清单', SEALED: '完成职责分离封存', UNSEALED: '授权解封', EXPORT_CREATED: '固化独立导出包' } as Record<string, string>)[value] || value; }
function formatDate(value: string) { return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(new Date(value)); }
function formatBytes(value: number) { return value < 1024 ? `${value} B` : `${(value / 1024).toFixed(1)} KB`; }
</script>

<template>
  <main id="main-content" class="content archive-content vue-native-page"><div class="page-heading archive-heading"><div><p class="eyebrow">病历中心 / 病案资产</p><h1>病案归档与法律证据</h1><p>按当前签署版本形成不可变清单，并通过职责分离完成封存；导出包可脱离系统独立读取和校验。</p></div><RouterLink class="button secondary" to="/record">返回病历中心</RouterLink></div>
    <ClinicalPageState v-if="archiveQuery.isPending.value" kind="loading" message="正在核验当前版本、质控与签名证据" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="archiveQuery.refetch()" />
    <template v-else-if="readiness">
      <section class="archive-metrics" aria-label="归档状态摘要"><article><span>就诊状态</span><strong>{{ encounterLabel(readiness.encounter_status) }}</strong><small>归档前必须为已结束</small></article><article><span>当前病历</span><strong>{{ readiness.document_count }}</strong><small>按当前版本生成清单</small></article><article :class="readiness.blockers.length ? 'metric-danger' : 'metric-success'"><span>硬性阻断</span><strong>{{ readiness.blockers.length }}</strong><small>确定性门禁，不由 AI 改写</small></article><article><span>病案状态</span><strong>{{ archiveCase ? archiveStatusLabel(archiveCase.status) : '未归档' }}</strong><small>{{ archiveCase ? `版本 ${archiveCase.row_version}` : '尚未形成病案号' }}</small></article></section>
      <div v-if="notice" class="notice archive-notice" role="status">{{ notice }}</div>
      <div class="archive-grid"><section class="archive-panel archive-gate-panel"><div class="archive-panel-heading"><div><span class="archive-step">01</span><h2>归档资格核验</h2></div><span class="state-chip" :class="{ signed: readiness.ready }">{{ readiness.ready ? '可归档' : archiveCase ? '已形成清单' : '存在阻断' }}</span></div><p class="archive-panel-intro">只认可服务端事实：就诊结束、当前版本已签署、最新质控通过且内容哈希一致、所有签名证据有效。</p>
        <div v-if="readiness.blockers.length" class="archive-blockers"><article v-for="blocker in readiness.blockers" :key="`${blocker.code}-${blocker.document_id || 'encounter'}`"><span>!</span><div><strong>{{ blockerLabel(blocker.code) }}</strong><p>{{ blocker.message }}</p><code v-if="blocker.document_id">文书 …{{ blocker.document_id.slice(-8) }}</code></div></article></div><div v-else class="archive-pass"><span>✓</span><div><strong>归档硬性条件已通过</strong><p>{{ archiveCase ? '不可变清单已经生成，后续操作不会覆盖原始病历版本。' : '可以由病案岗位生成不可变归档清单。' }}</p></div></div>
        <button v-if="!archiveCase" class="button primary" :disabled="!readiness.ready || Boolean(busy)" @click="createCase">{{ busy === 'archive' ? '正在形成清单…' : '生成病案归档清单' }}</button><div class="archive-truth-note"><strong>当前能力边界</strong><span>已覆盖电子病历清单、封存、解封、JSON 独立导出；纸质扫描、借阅审批、长期保存介质迁移仍属于后续切片。</span></div></section>
        <section class="archive-panel archive-action-panel"><div class="archive-panel-heading"><div><span class="archive-step">02</span><h2>封存与调阅控制</h2></div></div><div v-if="!archiveCase" class="archive-empty"><span>封</span><p>生成归档清单后，才会开放职责分离封存。</p></div><template v-else><dl class="archive-identity"><div><dt>病案号</dt><dd>{{ archiveCase.archive_no }}</dd></div><div><dt>清单哈希</dt><dd><code>{{ archiveCase.manifest_hash.slice(0, 18) }}…</code></dd></div><div><dt>归档人</dt><dd>…{{ archiveCase.archived_by.slice(-8) }}</dd></div><div><dt>当前状态</dt><dd>{{ archiveStatusLabel(archiveCase.status) }}</dd></div></dl><label class="archive-field"><span>{{ archiveCase.status === 'SEALED' ? '解封理由' : '复核说明' }}</span><textarea v-model="reason" rows="3" /></label><button v-if="archiveCase.status !== 'SEALED'" class="button primary full" :disabled="Boolean(busy)" @click="transition('seals')">{{ busy === 'seals' ? '封存中…' : '由独立岗位封存' }}</button><button v-else class="button secondary full" :disabled="Boolean(busy) || reason.trim().length < 4" @click="transition('unseals')">{{ busy === 'unseals' ? '解封中…' : '授权解封' }}</button><small class="archive-action-hint">归档人与首次封存人必须不同；解封仅允许临床管理员并永久保留理由。</small></template></section></div>
      <section class="archive-panel archive-manifest-panel"><div class="archive-panel-heading"><div><span class="archive-step">03</span><h2>不可变病历清单</h2></div><span>{{ archiveCase?.items.length || 0 }} 份文书</span></div><div v-if="!archiveCase" class="archive-empty horizontal"><span>清</span><p>尚未生成清单。这里不会用前端示例伪造已归档数据。</p></div><div v-else class="archive-table-wrap"><table class="archive-table"><thead><tr><th>序号</th><th>文书类型</th><th>文书 / 版本</th><th>内容哈希</th><th>签名摘要哈希</th></tr></thead><tbody><tr v-for="item in archiveCase.items" :key="item.archive_case_item_id"><td>{{ item.item_order }}</td><td>{{ item.document_type_code }}</td><td><code>…{{ item.document_id.slice(-8) }} / …{{ item.document_version_id.slice(-8) }}</code></td><td><code>{{ item.content_hash.slice(0, 14) }}…</code></td><td><code>{{ item.signature_summary_hash.slice(0, 14) }}…</code></td></tr></tbody></table></div></section>
      <div class="archive-grid archive-lower-grid"><section class="archive-panel"><div class="archive-panel-heading"><div><span class="archive-step">04</span><h2>证据事件时间轴</h2></div></div><div v-if="!archiveCase" class="archive-empty"><span>证</span><p>归档后显示不可变事件。</p></div><ol v-else class="archive-timeline"><li v-for="event in archiveCase.events" :key="event.archive_case_event_id"><span class="archive-event-dot" :class="event.event_type.toLowerCase()" /><div><strong>{{ eventLabel(event.event_type) }}</strong><small>{{ event.actor_display_name }} · {{ formatDate(event.occurred_at) }}</small><p v-if="event.reason">{{ event.reason }}</p></div><code>#{{ event.event_no }}</code></li></ol></section>
        <section class="archive-panel archive-export-panel"><div class="archive-panel-heading"><div><span class="archive-step">05</span><h2>独立可读导出</h2></div><span>JSON v1</span></div><p class="archive-panel-intro">导出正文包含病历段落、质控证据、签名证据和清单完整性信息；响应返回精确 UTF-8 字节数与 SHA-256。</p><label class="archive-field"><span>导出用途</span><input v-model="purpose" /></label><button class="button primary full" :disabled="!archiveCase || archiveCase.status !== 'SEALED' || Boolean(busy) || purpose.trim().length < 2" @click="createExport">{{ busy === 'export' ? '正在固化导出包…' : '生成带校验值的导出包' }}</button><small v-if="archiveCase && archiveCase.status !== 'SEALED'" class="archive-action-hint">只有封存状态允许生成或下载导出包。</small><div class="archive-exports"><article v-for="item in archiveCase?.export_packages || []" :key="item.export_package_id"><div><strong>{{ item.purpose }}</strong><small>{{ formatDate(item.created_at) }} · {{ formatBytes(item.byte_count) }}</small></div><code>SHA-256 {{ item.content_hash.slice(0, 16) }}…</code><span class="state-chip signed">{{ item.status }}</span></article></div></section></div>
    </template>
  </main>
</template>
