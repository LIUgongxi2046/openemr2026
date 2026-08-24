<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import { loadWorkforceIdentities } from '../../clinical-api';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const query = useQuery({ queryKey: ['admin', 'credentials'], queryFn: loadWorkforceIdentities, retry: false, staleTime: 0, gcTime: 0 });
const issue = computed(() => query.error.value ? toClinicalIssue(query.error.value) : null);
const identities = computed(() => query.data.value ?? []);
const credentialed = computed(() => identities.value.filter((identity) => identity.active_credential_count > 0).length);
</script>

<template>
  <main id="main-content" class="content admin-content vue-native-page">
    <div class="page-heading admin-heading">
      <div><p class="eyebrow">配置中心 / 人员与资质</p><h1>人员资质</h1><p>人员、账号、角色与资质分离管理；角色任期到期即失去授权。</p></div>
    </div>
    <ClinicalPageState v-if="query.isPending.value" kind="loading" message="正在读取人员资质" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="query.refetch()" />
    <template v-else>
      <section class="admin-metrics" aria-label="资质统计">
        <article><span>人员</span><strong>{{ identities.length }}</strong><small>在册</small></article>
        <article><span>持有效资质</span><strong>{{ credentialed }}</strong><small>资质数 &gt; 0</small></article>
      </section>
      <section class="admin-panel">
        <header><div><h2>资质台账</h2><p>账号与角色任期独立管理，停用即失效。</p></div><button class="button secondary" @click="query.refetch()">刷新</button></header>
        <div v-if="identities.length === 0" class="admin-empty">暂无人员记录。</div>
        <div v-else class="admin-table-wrap"><table class="admin-table"><thead><tr><th>姓名 / 编码</th><th>账号状态</th><th>角色</th><th>角色有效期</th><th>有效资质数</th></tr></thead><tbody>
          <tr v-for="identity in identities" :key="identity.person_id">
            <td><strong>{{ identity.person_display_name }}</strong><small><code>{{ identity.person_code }}</code></small></td>
            <td><span class="admin-status" :class="(identity.account_status ?? 'INACTIVE').toLowerCase()">{{ identity.account_status === 'ACTIVE' ? '启用' : (identity.account_status ?? '未开通') }}</span></td>
            <td><code>{{ identity.role_code ?? '—' }}</code></td>
            <td>{{ identity.role_valid_until ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(identity.role_valid_until)) : '长期' }}</td>
            <td><strong>{{ identity.active_credential_count }}</strong></td>
          </tr>
        </tbody></table></div>
      </section>
    </template>
  </main>
</template>
