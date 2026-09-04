<script setup lang="ts">
import { computed } from 'vue';
import { clinicalContext } from '../../clinical-api';
import { developmentCopy } from '../../development-copy';
import AgentInlineReview from '../components/AgentInlineReview.vue';

const patientId = computed(() => clinicalContext.patientId || null);
const encounterId = computed(() => clinicalContext.encounterId || null);

const glycemicObjective = computed(() => '对当前患者的血糖与胰岛素治理进行复核：识别低血糖风险、降糖方案与监测缺口，输出候选建议，仅供医生审阅。');
const cardiovascularObjective = computed(() => '对当前患者的心血管诊疗进行复核：结合胸痛、心衰、房颤、抗凝等线索输出候选建议，仅供医生审阅。');
const icuObjective = computed(() => '对当前患者的重症风险进行研判：识别脓毒症、病情恶化与危重征象，输出候选建议，仅供医生审阅。');
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page">
    <div class="page-heading admin-heading">
      <div>
        <p class="eyebrow">核心专科 / 专科医助复核</p>
        <h1>专科医助复核</h1>
        <p>血糖治理、心血管诊疗、重症风险研判三个专科医助的就地复核；候选仅供医生审阅，不自动写入业务终态。</p>
      </div>
    </div>

    <section class="patient-strip" aria-label="当前患者上下文">
      <div class="patient-avatar">{{ developmentCopy.patientAvatar }}</div>
      <div><strong>{{ clinicalContext.patientDisplayName || developmentCopy.outpatientPatientName }}</strong><span>当前门诊就诊</span></div>
      <span class="lease-badge">当前患者 / 当前就诊</span>
    </section>

    <div class="admin-layout specialty-ai-grid">
      <AgentInlineReview agent-code="GLYCEMIC_MANAGEMENT" stage-code="ADMISSION_GLUCOSE" :objective="glycemicObjective" :patient-id="patientId" :encounter-id="encounterId" target-type="ENCOUNTER" :target-id="encounterId" title="AI 血糖治理候选" source-route="clinical-specialty-ai" />
      <AgentInlineReview agent-code="CARDIOVASCULAR_CARE" stage-code="CHEST_PAIN" :objective="cardiovascularObjective" :patient-id="patientId" :encounter-id="encounterId" target-type="ENCOUNTER" :target-id="encounterId" title="AI 心血管诊疗候选" source-route="clinical-specialty-ai" />
      <AgentInlineReview agent-code="ICU_RISK_ASSESSMENT" stage-code="SEPSIS_RISK" :objective="icuObjective" :patient-id="patientId" :encounter-id="encounterId" target-type="ENCOUNTER" :target-id="encounterId" title="AI 重症风险研判候选" source-route="clinical-specialty-ai" />
    </div>
  </section>
</template>

<style scoped>
.specialty-ai-grid { display: grid; gap: 14px; align-items: start; }
@media (min-width: 900px) { .specialty-ai-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
</style>
