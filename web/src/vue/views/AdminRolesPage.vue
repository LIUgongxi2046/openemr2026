<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import { loadWorkforceIdentities } from '../../clinical-api';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const query = useQuery({ queryKey: ['admin', 'roles'], queryFn: loadWorkforceIdentities, retry: false, staleTime: 0, gcTime: 0 });
const issue = computed(() => query.error.value ? toClinicalIssue(query.error.value) : null);
const identities = computed(() => query.data.value ?? []);
const withRole = computed(() => identities.value.filter((i) => i.role_assignment_id).length);

function formatDate(value: string | null) { return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(value)) : '长期'; }
</script>

<template>
  <main id="main-content" class="content admin-content vue-native-page">
    <div class="page-heading admin-heading"><div><p class="eyebrow">配置中心 / 角色</p><h1>角色与任期</h1><p>角色任期到期即失去授权；账号停用会立即失效未到期租约。</p></div></div>
    <ClinicalPageState v-if="query.isPending.value" kind="loading" message="正在读取角色" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="query.refetch()" />
    <template v-else>
      <section class="admin-metrics"><article><span>人员</span><strong>{{ identities.length }}</strong><small>在册</small></article><article><span>已授权角色</span><strong>{{ withRole }}</strong><small>有角色任期</small></article></section>
      <section class="admin-panel"><header><div><h2>角色台账</h2><p>角色与岗位分离管理。</p></div><button class="button secondary" @click="query.refetch()">刷新</button></header>
        <div v-if="!identities.length" class="admin-empty">暂无人员。</div>
        <div v-else class="admin-table-wrap"><table class="admin-table"><thead><tr><th>人员</th><th>角色</th><th>岗位</th><th>有效期</th></tr></thead><tbody>
          <tr v-for="identity in identities" :key="identity.person_id"><td><strong>{{ identity.person_display_name }}</strong><small><code>{{ identity.person_code }}</code></small></td><td><code>{{ identity.role_code ?? '—' }}</code></td><td>{{ identity.position_code ?? '—' }}</td><td>{{ formatDate(identity.role_valid_until) }}</td></tr>
        </tbody></table></div>
      </section>
    </template>
  </main>
</template>
