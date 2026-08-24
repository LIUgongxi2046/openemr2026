<script setup lang="ts">
import { clinicalContext } from '../../clinical-api';
function shortId(value: string) { return value ? '…' + value.slice(-8) : '—'; }
</script>
<template>
  <section data-page-root class="content vue-native-page">
    <div class="page-head"><div class="page-title"><h1>登录、锁屏恢复与工作上下文</h1><p>专有身份标识、SSO/MFA、机构、岗位与班次上下文</p></div></div>
    <div class="portal-safety"><b>会话上下文</b><span>生产身份必须来自 OIDC 会话注入；开发合成环境使用固定合成身份。</span><span class="status green">会话有效</span></div>
    <div class="admin-layout">
      <section class="admin-panel">
        <header><div><h2>当前工作上下文</h2><p>登录身份、机构与岗位范围。</p></div></header>
        <div class="card-body">
          <div class="folder-row">租户<span><code>{{ shortId(clinicalContext.tenantId) }}</code></span></div>
          <div class="folder-row">机构<span><code>{{ shortId(clinicalContext.organizationId) }}</code></span></div>
          <div class="folder-row">院区<span><code>{{ shortId(clinicalContext.facilityId) }}</code></span></div>
          <div class="folder-row">用户<span><code>{{ shortId(clinicalContext.userId) }}</code></span></div>
          <div class="folder-row">岗位角色<span><code>{{ shortId(clinicalContext.roleId) }}</code></span></div>
          <div class="folder-row">患者上下文<span><code>{{ clinicalContext.patientId ? shortId(clinicalContext.patientId) : '无（院区级）' }}</code></span></div>
          <div class="folder-row">就诊上下文<span><code>{{ clinicalContext.encounterId ? shortId(clinicalContext.encounterId) : '无（院区级）' }}</code></span></div>
        </div>
      </section>
      <aside class="admin-panel">
        <header><div><h2>身份与锁屏</h2></div></header>
        <div class="card-body">
          <div class="notice rule"><div class="notice-title">岗位资质到期</div>当前岗位资质将在 2 天后到期；到期后禁止新临床写入，既往署名不受影响。</div>
          <div class="notice info"><div class="notice-title">SSO / MFA</div>生产由 OIDC + MFA 注入；锁屏后需重新验证方可恢复工作上下文。</div>
          <div class="folder-row">班次<span>今日 08:00 – 17:00</span></div>
          <div class="folder-row">身份来源<span>开发合成环境</span></div>
        </div>
      </aside>
    </div>
  </section>
</template>
