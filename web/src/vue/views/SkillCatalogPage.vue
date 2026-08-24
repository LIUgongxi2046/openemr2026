<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import type { SkillRegistryWire } from '../../generated/contracts';
import { deactivateSkill, issueAiLease, listSkills, registerSkill } from '../../api/ai-platform';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const leaseQuery = useQuery({
  queryKey: ['ai-platform', 'skill-catalog', 'lease'],
  queryFn: () => issueAiLease('AI_PLATFORM_ADMIN'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const skillsQuery = useQuery({
  queryKey: ['ai-platform', 'skill-catalog', 'skills'],
  queryFn: () => listSkills(leaseQuery.data.value!),
  enabled: () => Boolean(leaseQuery.data.value),
  retry: false,
});
const issue = computed(() => (leaseQuery.error.value ?? skillsQuery.error.value)
  ? toClinicalIssue(leaseQuery.error.value ?? skillsQuery.error.value) : null);
const skills = computed(() => skillsQuery.data.value ?? []);
const activeCount = computed(() => skills.value.filter((skill) => skill.status === 'ACTIVE').length);

const form = reactive({ skillCode: '', skillName: '', skillVersion: '' });
const busy = ref('');
const notice = ref('');

async function reload() {
  notice.value = '';
  await skillsQuery.refetch();
}

async function register() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || !form.skillCode.trim() || !form.skillName.trim() || !form.skillVersion.trim()) return;
  busy.value = 'create'; notice.value = '';
  try {
    await registerSkill(lease, {
      skill_code: form.skillCode.trim(),
      skill_name: form.skillName.trim(),
      skill_version: form.skillVersion.trim(),
    });
    form.skillCode = ''; form.skillName = ''; form.skillVersion = '';
    notice.value = 'Skill 已登记，审计链与事件出箱已同步记录。';
    await skillsQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}

async function deactivate(skill: SkillRegistryWire) {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || skill.status !== 'ACTIVE') return;
  busy.value = skill.skill_registry_id; notice.value = '';
  try {
    await deactivateSkill(lease, skill);
    notice.value = `Skill ${skill.skill_name} 已停用。`;
    await skillsQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page">
    <div class="page-heading admin-heading">
      <div>
        <p class="eyebrow">AI 平台 / Skill 目录与定义编辑器</p>
        <h1>Skill 目录</h1>
        <p>登记与停用可复用 Skill；所有变更使用幂等键、审计链与事件出箱，停用不物理删除。</p>
      </div>
    </div>

    <ClinicalPageState v-if="leaseQuery.isPending.value || skillsQuery.isPending.value" kind="loading" message="正在读取 Skill 目录" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />

    <template v-else>
      <section class="admin-metrics" aria-label="Skill 统计">
        <article><span>Skill</span><strong>{{ skills.length }}</strong><small>全部登记</small></article>
        <article><span>有效 Skill</span><strong>{{ activeCount }}</strong><small>ACTIVE</small></article>
      </section>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>

      <div class="admin-layout">
        <section class="admin-panel">
          <header>
            <div><h2>Skill 台账</h2><p>编码与版本不可变；停用保留历史语义。</p></div>
            <button class="button secondary" @click="skillsQuery.refetch()">刷新</button>
          </header>
          <div v-if="skills.length === 0" class="admin-empty" role="status">暂无 Skill，可在右侧登记。</div>
          <div v-else class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>名称</th><th>编码</th><th>版本</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-for="skill in skills" :key="skill.skill_registry_id">
                  <td><strong>{{ skill.skill_name }}</strong><small>…{{ skill.skill_registry_id.slice(-8) }}</small></td>
                  <td><code>{{ skill.skill_code }}</code></td>
                  <td><code>{{ skill.skill_version }}</code></td>
                  <td><span class="admin-status" :class="skill.status.toLowerCase()">{{ skill.status === 'ACTIVE' ? '有效' : '已停用' }}</span></td>
                  <td><button class="task-action" :disabled="skill.status !== 'ACTIVE' || Boolean(busy)" @click="deactivate(skill)">{{ busy === skill.skill_registry_id ? '处理中…' : '停用' }}</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="admin-panel admin-form-panel">
          <header><div><h2>登记 Skill</h2><p>编码、名称与版本均为必填。</p></div></header>
          <form class="admin-form" @submit.prevent="register">
            <label><span>Skill 编码</span><input v-model="form.skillCode" maxlength="128" required placeholder="例：MEDICAL-NOTE" /></label>
            <label><span>Skill 名称</span><input v-model="form.skillName" maxlength="256" required placeholder="例：病历摘要" /></label>
            <label><span>版本</span><input v-model="form.skillVersion" maxlength="64" required placeholder="例：1.0.0" /></label>
            <button class="button primary full" :disabled="Boolean(busy)">{{ busy === 'create' ? '正在登记…' : '登记并生效' }}</button>
          </form>
        </section>
      </div>
    </template>
  </section>
</template>
