<script setup lang="ts">
import { clinicalContext } from '../../clinical-api';
import { developmentCopy } from '../../development-copy';
</script>

<template>
  <section class="patient-strip record-prototype-patient" aria-label="患者与就诊上下文">
    <div>
      <div class="patient-name">{{ developmentCopy.patientName }}</div>
      <div class="meta">合成患者 · 患者号 …{{ clinicalContext.patientId.slice(-6) }}</div>
    </div>
    <div class="divider" />
    <div>
      <b>门诊号 …{{ clinicalContext.encounterId.slice(-6) }}</b>
      <div class="meta">心内科 · 当前门诊就诊 · 诊疗中</div>
    </div>
    <div class="divider" />
    <div>
      <b>当前病历上下文已核验</b>
      <div class="meta">患者、就诊、岗位与数据范围受控</div>
    </div>
    <div class="divider" />
    <span class="risk red">过敏信息待核</span>
    <span class="risk amber">跌倒风险待核</span>
    <RouterLink class="btn sm record-patient-switch" to="/outpatient">切换门诊患者</RouterLink>
  </section>
</template>
