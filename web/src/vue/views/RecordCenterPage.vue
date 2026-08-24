<script setup lang="ts">
import { computed } from 'vue';

import { clinicalContext } from '../../clinical-api';
import { developmentCopy } from '../../development-copy';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';
import { useCurrentDocument } from '../composables/use-current-document';

const current = useCurrentDocument();
const issue = computed(() => current.error.value ? toClinicalIssue(current.error.value) : null);
const document = computed(() => current.data.value?.document);
const filledSections = computed(() => Object.values(document.value?.sections ?? {}).filter((value) => String(value ?? '').trim()).length);
</script>

<template>
  <section data-page-root class="content vue-native-page">
    <div class="page-heading record-center-heading"><div><p class="eyebrow">病历主轴 / 本次就诊</p><h1>病历中心工作台</h1></div>
      <RouterLink class="button primary" to="/opd-record">进入门诊病历编辑</RouterLink></div>
    <p class="record-center-intro">病历中心独立管理文书、版本、质控、签署与来源；不与门诊工作台共用一级路由。</p>
    <section class="patient-strip" aria-label="患者与就诊上下文"><div class="patient-avatar">{{ developmentCopy.patientAvatar }}</div>
      <div><strong>{{ developmentCopy.patientName }}</strong><span>当前门诊就诊</span></div><dl>
        <div><dt>患者标识</dt><dd>…{{ clinicalContext.patientId.slice(-6) }}</dd></div>
        <div><dt>就诊标识</dt><dd>…{{ clinicalContext.encounterId.slice(-6) }}</dd></div>
        <div><dt>一级归属</dt><dd>病历中心</dd></div></dl></section>
    <ClinicalPageState v-if="current.isPending.value" kind="loading" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="current.refetch()" />
    <template v-else-if="document">
      <section class="record-center-metrics" aria-label="病历指标">
        <article><span>当前文书</span><strong>1</strong><small>{{ document.document_type_code }}</small></article>
        <article><span>版本</span><strong>v{{ document.version_no }}</strong><small>行版本 {{ document.row_version }}</small></article>
        <article><span>文书状态</span><strong>{{ document.status }}</strong><small>禁止覆盖已签版本</small></article>
        <article><span>已填章节</span><strong>{{ filledSections }}</strong><small>由当前版本实时计算</small></article>
      </section>
      <div class="record-center-layout"><article class="record-document-card"><header><div><span class="record-type">门诊</span><strong>{{ document.document_type_code }}</strong></div>
        <span class="state-chip">{{ document.status }}</span></header><dl>
          <div><dt>文书 ID</dt><dd>…{{ document.document_id.slice(-8) }}</dd></div>
          <div><dt>内容指纹</dt><dd>{{ document.content_hash.slice(0, 12) }}…</dd></div>
          <div><dt>当前版本</dt><dd>v{{ document.version_no }} / row {{ document.row_version }}</dd></div>
          <div><dt>下一动作</dt><dd>{{ document.status === 'SIGNED' ? '复核法律证据' : '继续编辑并补齐结构' }}</dd></div></dl>
        <footer><RouterLink class="button primary" to="/opd-record">继续编辑</RouterLink>
          <RouterLink class="button secondary" to="/record-qc">质控与审签</RouterLink>
          <RouterLink class="button secondary" to="/record-sources">来源与附件</RouterLink>
          <RouterLink class="button secondary" to="/record-versions">版本证据</RouterLink>
          <RouterLink class="button secondary" to="/archive-assets">病案归档</RouterLink></footer></article>
        <aside class="record-center-rail"><h2>病历安全边界</h2><div><b>版本追溯</b><span>每次保存形成新版本，已签内容不可覆盖。</span></div>
          <div><b>来源可回看</b><span>诊断、医嘱、结果和 AI 候选均保留来源标识。</span></div>
          <div><b>一级路由隔离</b><span>进入门诊不会把病历中心标记为门诊菜单所有。</span></div></aside></div>
    </template>
  </section>
</template>
