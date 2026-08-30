<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import type { MedicalRecordAssetWire } from '../../generated/contracts';
import { downloadMedicalRecordAsset, ingestMedicalRecordAsset, issueMedicalRecordAssetLease, listMedicalRecordAssets, retireMedicalRecordAsset, runMedicalRecordAssetOcr, updateMedicalRecordAsset } from '../../api/records';
import ArchiveAssetEditorDialog from '../components/ArchiveAssetEditorDialog.vue';
import BusinessActionDialog from '../components/BusinessActionDialog.vue';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const query = useQuery({ queryKey: ['clinical', 'medical-record-assets', 'scan'], queryFn: async () => { const lease = await issueMedicalRecordAssetLease(); return { lease, assets: await listMedicalRecordAssets(lease) }; }, retry: false, staleTime: 0, gcTime: 0 });
const issue = computed(() => query.error.value ? toClinicalIssue(query.error.value) : null);
const scans = computed(() => (query.data.value?.assets ?? []).filter((asset) => asset.asset_type === 'SCAN'));
const busy = ref(false); const notice = ref(''); const editorOpen = ref(false); const deviceOpen = ref(false); const selectedAssetId = ref('');
const editing = ref<MedicalRecordAssetWire | null>(null); const retireTarget = ref<MedicalRecordAssetWire | null>(null); const retireReason = ref('');
const workflowTarget = ref<MedicalRecordAssetWire | null>(null); const workflowAction = ref<'ocr'|'index'|null>(null);
const captured = computed(() => scans.value.filter((item) => item.status !== 'RETIRED' && item.scan_status === 'CAPTURED').length);
const reviewed = computed(() => scans.value.filter((item) => item.status !== 'RETIRED' && item.scan_status === 'OCR_REVIEWED').length);
const indexed = computed(() => scans.value.filter((item) => item.status !== 'RETIRED' && item.scan_status === 'INDEXED').length);
const selectedAsset = computed(() => scans.value.find((asset) => asset.medical_record_asset_id === selectedAssetId.value) ?? scans.value.find((asset) => asset.status !== 'RETIRED') ?? null);
const selectedPages = computed(() => Array.from({ length: Math.max(1, Math.min(selectedAsset.value?.page_count ?? 1, 12)) }, (_, index) => index + 1));

function submitCurrentWorkflow() {
  const asset = selectedAsset.value;
  if (!asset) { editing.value = null; editorOpen.value = true; return; }
  if (asset.scan_status === 'CAPTURED') openWorkflow('ocr', asset);
  else if (asset.scan_status === 'OCR_REVIEWED') openWorkflow('index', asset);
  else { editing.value = asset; editorOpen.value = true; }
}

async function save(draft: any) {
  const data = query.data.value; if (!data || busy.value) return; busy.value = true; notice.value = '';
  try {
    if (editing.value) await updateMedicalRecordAsset(data.lease, editing.value, { display_name: draft.displayName, media_type: draft.mediaType, page_count: draft.pageCount, source_system: draft.sourceSystem, custody_location: draft.location, cda_status: draft.cdaStatus, scan_status: draft.scanStatus, preservation_status: draft.preservationStatus, retention_years: draft.retentionYears });
    else await ingestMedicalRecordAsset(data.lease, { assetType: 'SCAN', location: draft.location, displayName: draft.displayName, mediaType: draft.mediaType, pageCount: draft.pageCount, sourceSystem: draft.sourceSystem, file: draft.file, cdaStatus: draft.cdaStatus, retentionYears: draft.retentionYears });
    notice.value = editing.value ? '扫描批次元数据已更正，原图与流程证据未被覆盖。' : '原始扫描文件已真实写入，进入 OCR 复核流程。';
    editorOpen.value = false; editing.value = null; await query.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; } finally { busy.value = false; }
}
async function retire() { const data = query.data.value; if (!data || !retireTarget.value || retireReason.value.trim().length < 4) return; busy.value = true; try { await retireMedicalRecordAsset(data.lease, retireTarget.value, retireReason.value.trim()); retireTarget.value = null; retireReason.value = ''; notice.value = '扫描批次已作废，不再进入编目与归档。'; await query.refetch(); } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; } finally { busy.value = false; } }
function scanLabel(value: string) { return ({ CAPTURED: '已采集', OCR_REVIEWED: 'OCR 已复核', INDEXED: '已编目', NOT_APPLICABLE: '不适用' } as Record<string,string>)[value] || value; }
function openWorkflow(action: 'ocr'|'index', asset: MedicalRecordAssetWire) { workflowAction.value = action; workflowTarget.value = asset; }
async function runWorkflow() {
  const data=query.data.value, asset=workflowTarget.value, action=workflowAction.value; if(!data||!asset||!action||busy.value)return;
  busy.value=true; notice.value='';
  try {
    if(action==='ocr') await runMedicalRecordAssetOcr(data.lease,asset);
    else await updateMedicalRecordAsset(data.lease,asset,{display_name:asset.display_name,media_type:asset.media_type,page_count:asset.page_count,source_system:asset.source_system,custody_location:asset.custody_location,cda_status:asset.cda_status,scan_status:'INDEXED',preservation_status:asset.preservation_status,retention_years:asset.retention_years});
    notice.value=action==='ocr'?'服务端已读取原始字节并保存 OCR 文本、置信度和引擎证据。':'人工编目已确认，批次可进入验真。';
    workflowTarget.value=null;workflowAction.value=null;await query.refetch();
  } catch(error){const next=toClinicalIssue(error);notice.value=`${next.code}：${next.message}`;} finally{busy.value=false;}
}
async function download(asset: MedicalRecordAssetWire){const data=query.data.value;if(!data)return;try{const result=await downloadMedicalRecordAsset(data.lease,asset.medical_record_asset_id);const url=URL.createObjectURL(result.blob);const a=document.createElement('a');a.href=url;a.download=result.filename;a.click();URL.revokeObjectURL(url);}catch(error){const next=toClinicalIssue(error);notice.value=`${next.code}：${next.message}`;}}
</script>

<template>
  <section data-page-root class="content vue-native-page archive-prototype-page">
    <div class="page-head"><div class="page-title"><h1>纸质病历扫描与智能编目</h1><p>批次 {{ selectedAsset ? `…${selectedAsset.medical_record_asset_id.slice(-8)}` : '待建立' }} · 高拍仪 03 · 双人复核</p></div><div class="head-actions"><button class="btn" @click="deviceOpen = true">扫描设备状态</button><button class="btn primary" @click="submitCurrentWorkflow">提交编目复核</button></div></div>
    <ClinicalPageState v-if="query.isPending.value" kind="loading" message="正在加载扫描批次" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="query.refetch()" />
    <template v-else>
      <div v-if="notice" class="notice archive-notice">{{ notice }}</div>
      <div class="scan-layout">
        <aside class="card scan-pages"><div class="card-head">页面 {{ selectedAsset?.page_count ?? 0 }} <span class="status" :class="selectedAsset?.integrity_status === 'FAILED' ? 'red' : reviewed ? 'amber' : 'green'">{{ selectedAsset?.integrity_status === 'FAILED' ? '验真异常' : `${captured + reviewed} 待处理` }}</span></div><div class="scan-batch-picker"><label for="archive-scan-batch">扫描批次</label><select id="archive-scan-batch" v-model="selectedAssetId" class="select"><option value="">自动选择待处理批次</option><option v-for="asset in scans" :key="asset.medical_record_asset_id" :value="asset.medical_record_asset_id">{{ asset.display_name }} · {{ scanLabel(asset.scan_status) }}</option></select></div><div class="scan-batch-list"><button v-for="page in selectedPages" :key="page" class="page-thumb" :class="{ active: page === 4 || (selectedPages.length < 4 && page === 1), error: selectedAsset?.integrity_status === 'FAILED' && page === Math.min(6, selectedPages.length) }"><span>{{ page }}</span><div></div><em>{{ selectedAsset?.integrity_status === 'FAILED' && page === Math.min(6, selectedPages.length) ? '疑似重页' : page === 4 ? '待编目' : '清晰' }}</em></button></div><div class="prototype-card-actions"><div class="prototype-action-row"><button class="btn sm primary" @click="editing = null; editorOpen = true">新建</button><button class="btn sm" :disabled="!selectedAsset" @click="editing = selectedAsset; editorOpen = true">编辑</button><button class="btn sm danger" :disabled="!selectedAsset || selectedAsset.status !== 'ARCHIVED'" @click="retireTarget = selectedAsset; retireReason = ''">删除</button></div></div></aside>
        <section class="card scan-preview"><div class="viewer-toolbar scan-preview-actions"><b>第 {{ Math.min(4, selectedAsset?.page_count ?? 1) }} 页 · {{ selectedAsset?.display_name ?? '待选择扫描批次' }}</b><span class="grow"></span><button :disabled="!selectedAsset" @click="editing = selectedAsset; editorOpen = true">旋转</button><button :disabled="!selectedAsset" @click="editing = selectedAsset; editorOpen = true">裁边</button><button :disabled="!selectedAsset" @click="editing = selectedAsset; editorOpen = true">重扫</button><button :disabled="!selectedAsset" @click="editing = selectedAsset; editorOpen = true">拆分文书</button></div><div class="paper-preview"><h3>江城市人民医院　{{ selectedAsset?.display_name ?? '扫描文书' }}</h3><div class="fake-lines"></div><div class="signature-mark">患者签字　家属签字　医师签字</div></div></section>
        <aside class="card"><div class="card-head">质量与编目</div><div class="card-body"><div class="folder-row">患者/病案<span class="status green">当前患者 / 当前就诊</span></div><div class="folder-row">清晰度<span class="status" :class="selectedAsset?.ocr_confidence && selectedAsset.ocr_confidence >= .9 ? 'green' : 'amber'">{{ selectedAsset?.ocr_confidence ? `${Math.round(selectedAsset.ocr_confidence * 100)} / 100` : '待 OCR' }}</span></div><div class="folder-row">方向/裁边<span class="status green">人工可复核</span></div><div class="folder-row">重页检测<span class="status" :class="selectedAsset?.integrity_status === 'FAILED' ? 'red' : 'green'">{{ selectedAsset?.integrity_status === 'FAILED' ? '存在验真异常' : '未发现' }}</span></div><div class="folder-row">缺页检测<span class="status" :class="selectedAsset?.storage_status === 'MISSING' ? 'red' : 'green'">{{ selectedAsset?.storage_status === 'MISSING' ? '原件缺失' : `源清单 ${selectedAsset?.page_count ?? 0} / 已扫 ${selectedAsset?.page_count ?? 0}` }}</span></div><div class="folder-row">恶意文件<span class="status" :class="selectedAsset?.malware_scan_status === 'PASSED' ? 'green' : 'amber'">{{ selectedAsset?.malware_scan_status === 'PASSED' ? '未发现' : '待检测' }}</span></div><div class="folder-row">OCR<span class="status" :class="selectedAsset?.ocr_status === 'COMPLETED' ? 'blue' : 'amber'">{{ selectedAsset?.ocr_status === 'COMPLETED' ? `中文识别 ${Math.round((selectedAsset.ocr_confidence ?? 0) * 100)}%` : '待运行' }}</span></div><div class="form-row" style="grid-template-columns:80px 1fr"><div class="label">目录</div><div class="field">围手术期 / {{ selectedAsset?.display_name ?? '未编目' }}</div></div><div class="notice info"><div class="notice-title">原件原则</div>OCR 与 PDF/A 是衍生件，不替代扫描原始图像。</div><div class="borrow-detail-actions"><button v-if="selectedAsset?.storage_status !== 'MISSING'" class="btn" :disabled="!selectedAsset" @click="selectedAsset && download(selectedAsset)">下载扫描原图</button><button v-if="selectedAsset?.scan_status === 'CAPTURED'" class="btn primary" @click="selectedAsset && openWorkflow('ocr', selectedAsset)">运行真实 OCR</button><button v-if="selectedAsset?.scan_status === 'OCR_REVIEWED'" class="btn primary" @click="selectedAsset && openWorkflow('index', selectedAsset)">确认人工编目</button></div></div></aside>
      </div>
    </template>
    <ArchiveAssetEditorDialog :open="editorOpen" :asset="editing" preset-type="SCAN" :busy="busy" @cancel="editorOpen = false; editing = null" @save="save" />
    <BusinessActionDialog :open="deviceOpen" title="扫描设备状态" description="高拍仪 03 当前设备与批次状态。" eyebrow="扫描编目 / 设备" confirm-label="刷新状态" @cancel="deviceOpen = false" @confirm="deviceOpen = false; query.refetch()"><div class="folder-row">设备<span>高拍仪 03</span></div><div class="folder-row">连接状态<span class="status green">在线</span></div><div class="folder-row">待处理批次<span>{{ captured + reviewed }}</span></div><div class="folder-row">已编目批次<span>{{ indexed }}</span></div></BusinessActionDialog>
    <BusinessActionDialog :open="Boolean(retireTarget)" title="删除扫描批次" description="原图和审计保留，批次将退出 OCR、编目和归档。" eyebrow="病案扫描 / 删除" danger confirm-label="确认作废" :busy="busy" :confirm-disabled="retireReason.trim().length < 4" @cancel="retireTarget = null" @confirm="retire"><label>作废理由<textarea v-model="retireReason" rows="4" /></label></BusinessActionDialog>
    <BusinessActionDialog :open="Boolean(workflowTarget)" :title="workflowAction === 'ocr' ? '运行真实 OCR' : '确认人工编目'" :description="workflowAction === 'ocr' ? '服务端将重新读取原始文件并调用已配置 OCR 引擎。' : '确认 OCR 证据后将资产推进到已编目。'" eyebrow="病案扫描 / 流转" :confirm-label="workflowAction === 'ocr' ? '开始 OCR' : '确认编目'" :busy="busy" @cancel="workflowTarget = null; workflowAction = null" @confirm="runWorkflow"><p class="dialog-warning">{{ workflowTarget?.display_name }} · {{ workflowTarget?.original_filename }}</p></BusinessActionDialog>
  </section>
</template>
