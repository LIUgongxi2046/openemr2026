<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, nextTick, ref, watch } from 'vue';

import { issueContextLease } from '../../clinical-api';
import { streamAssistantResponse } from '../../api/assistant';
import { toClinicalIssue } from '../clinical-error';

interface ChatMessage { role: 'user' | 'assistant'; text: string }

const props = defineProps<{
  open: boolean;
  routeId: string;
  contextLabel: string;
  patientId: string | null;
  encounterId: string | null;
  taskId: string | null;
}>();
const emit = defineEmits<{ close: [] }>();

const dialog = ref<HTMLDialogElement | null>(null);
const messages = ref<ChatMessage[]>([]);
const draft = ref('');
const busy = ref(false);
const notice = ref('');
const contextKey = computed(() => [props.routeId, props.patientId, props.encounterId, props.taskId].join(':'));
const leaseQuery = useQuery({
  queryKey: computed(() => ['global-assistant', 'lease', contextKey.value]),
  queryFn: () => issueContextLease(props.patientId, props.encounterId, 'AI_ASSISTANT'),
  enabled: computed(() => props.open),
  retry: false,
  staleTime: 5 * 60_000,
  gcTime: 0,
});
const issue = computed(() => leaseQuery.error.value ? toClinicalIssue(leaseQuery.error.value) : null);

watch(() => props.open, async (open) => {
  await nextTick();
  const element = dialog.value;
  if (!element) return;
  if (open && !element.open) element.showModal();
  if (!open && element.open) element.close();
}, { immediate: true });

watch(contextKey, () => {
  messages.value = [];
  draft.value = '';
  notice.value = '';
});

function requestClose() {
  emit('close');
}

function cancel(event: Event) {
  event.preventDefault();
  requestClose();
}

function closed() {
  if (props.open) requestClose();
}

async function send() {
  const lease = leaseQuery.data.value;
  const text = draft.value.trim();
  if (!lease || busy.value || !text) return;
  busy.value = true;
  notice.value = '';
  messages.value.push({ role: 'user', text });
  draft.value = '';
  try {
    const contextualMessage = `当前页面 route_id=${props.routeId}${props.taskId ? `, task_id=${props.taskId}` : ''}。用户问题：${text}`;
    const chunks = await streamAssistantResponse(lease, contextualMessage, props.patientId, props.encounterId);
    const reply = chunks.filter((chunk) => chunk.event === 'delta').map((chunk) => chunk.data).join('\n');
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
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="global-ai-dialog"
      aria-labelledby="global-ai-dialog-title"
      aria-describedby="global-ai-dialog-context"
      @cancel="cancel"
      @close="closed"
    >
      <div class="global-ai-dialog-shell">
        <header>
          <div>
            <span>AI 候选制 · 不自动写入临床事实</span>
            <h2 id="global-ai-dialog-title">随行 AI 助手</h2>
            <p id="global-ai-dialog-context">{{ contextLabel }} · route {{ routeId }}<template v-if="taskId"> · 任务已绑定</template></p>
          </div>
          <button type="button" aria-label="关闭随行 AI 助手" @click="requestClose">×</button>
        </header>

        <section class="global-ai-thread" aria-live="polite">
          <div v-if="leaseQuery.isPending.value" class="global-ai-empty">正在建立最小授权上下文…</div>
          <div v-else-if="issue" class="global-ai-empty error">上下文失败：{{ issue.code }} {{ issue.message }}</div>
          <div v-else-if="messages.length === 0" class="global-ai-empty">
            <strong>当前页面上下文已绑定</strong>
            <p>问题会带上 route/任务标识，患者与就诊授权通过 ContextLease 传递，不写入 URL 或消息文本。</p>
          </div>
          <article v-for="(message, index) in messages" :key="index" class="global-ai-message" :class="message.role">
            <b>{{ message.role === 'user' ? '你' : 'AI 候选' }}</b>
            <p>{{ message.text }}</p>
          </article>
        </section>

        <form class="global-ai-composer" @submit.prevent="send">
          <p v-if="notice" role="status" class="inline-notice error">{{ notice }}</p>
          <label for="global-ai-draft">输入问题</label>
          <textarea id="global-ai-draft" v-model="draft" :disabled="busy || !leaseQuery.data.value" rows="4" placeholder="询问当前页面，或要求生成可核验的草稿…" @keydown.enter.exact.prevent="send" />
          <div>
            <RouterLink class="btn" to="/ai-assistant" @click="requestClose">打开完整助手</RouterLink>
            <button class="btn primary" type="submit" :disabled="busy || !draft.trim() || !leaseQuery.data.value">{{ busy ? '正在生成…' : '发送' }}</button>
          </div>
        </form>
      </div>
    </dialog>
  </Teleport>
</template>
