<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import { issueAssistantFacilityLease, streamAssistantResponse } from '../../api/assistant';
import { toClinicalIssue } from '../clinical-error';

interface ChatMessage { role: 'user' | 'assistant'; text: string; }

const leaseQuery = useQuery({
  queryKey: ['assistant', 'lease'],
  queryFn: () => issueAssistantFacilityLease(),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const issue = computed(() => leaseQuery.error.value ? toClinicalIssue(leaseQuery.error.value) : null);

const messages = ref<ChatMessage[]>([]);
const draft = ref('');
const busy = ref(false);
const notice = ref('');

async function send() {
  const lease = leaseQuery.data.value;
  const text = draft.value.trim();
  if (!lease || busy.value || !text) return;
  busy.value = true; notice.value = '';
  messages.value.push({ role: 'user', text });
  draft.value = '';
  try {
    const chunks = await streamAssistantResponse(lease, text);
    const reply = chunks
      .filter((chunk) => chunk.event === 'delta')
      .map((chunk) => chunk.data)
      .join('\n');
    messages.value.push({ role: 'assistant', text: reply || '（无回复）' });
  } catch (error) {
    const next = toClinicalIssue(error);
    notice.value = `${next.code}：${next.message}`;
    messages.value.push({ role: 'assistant', text: `请求失败：${next.message}` });
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section data-page-root class="content vue-native-page">
    <div class="page-head">
      <div class="page-title"><h1>临床 AI 助手</h1><p>跨页面连续但按患者、就诊和任务严格隔离 · 确定性假模型 · 建议不自动写入病历</p></div>
      <div class="head-actions"><button class="btn" type="button" @click="messages = []">清空对话</button></div>
    </div>

    <div v-if="leaseQuery.isPending.value" class="card"><div class="card-body">正在建立助手会话上下文…</div></div>
    <div v-else-if="issue" class="card"><div class="card-body">上下文失败：{{ issue.code }} {{ issue.message }}</div></div>

    <div v-else class="grid ai-workspace-layout">
      <aside class="card">
        <div class="card-head">上下文与权限</div>
        <div class="card-body">
          <div class="notice info"><div class="notice-title">患者/就诊隔离</div>本会话按上下文租约隔离，跨患者或跨就诊不共享会话；AI 只出候选，不获得独立临床权力。</div>
          <div class="folder-row">当前作用域<span>院区级（无患者）</span></div>
          <div class="folder-row">允许动作<span>只读问答 · 不写入病历</span></div>
          <div class="folder-row">模型行为<span>DETERMINISTIC_FAKE</span></div>
        </div>
      </aside>

      <section class="card ai-conversation">
        <div class="card-head">与 openemr AI 协作 <span class="status green">确定性假模型</span></div>
        <div class="ai-thread">
          <div v-if="messages.length === 0" class="ai-message assistant">
            <b>随行助手已就绪</b>
            <p>输入问题后，助手返回确定性测试回复以验证 SSE 流式通道；建议均为候选，不会自动写入病历、诊断、医嘱或处方。</p>
          </div>
          <div v-for="(message, index) in messages" :key="index" class="ai-message" :class="message.role">
            <p>{{ message.text }}</p>
          </div>
        </div>
        <div class="ai-prompt-box">
          <div v-if="notice" class="inline-notice error" role="status">{{ notice }}</div>
          <textarea v-model="draft" :disabled="busy" placeholder="询问当前患者，或要求生成可核验的草稿……" @keydown.enter.exact.prevent="send" />
          <div>
            <button class="btn" type="button" :disabled="busy" @click="draft = ''">清空</button>
            <button class="btn primary" type="button" :disabled="busy || !draft.trim()" @click="send">{{ busy ? '正在生成…' : '发送' }}</button>
          </div>
        </div>
      </section>
    </div>
  </section>
</template>
