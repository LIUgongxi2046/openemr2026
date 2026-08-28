<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { authSession, loginClinicalSession } from '../../auth-session';
import { clinicalContext } from '../../clinical-api';

const route = useRoute();
const router = useRouter();
const form = reactive({ username: '', password: '' });
const busy = ref(false);
const message = ref('');
const passwordVisible = ref(false);

function applyContext() {
  const user = authSession.user;
  if (!user) return;
  clinicalContext.tenantId = user.tenant_id;
  clinicalContext.organizationId = user.organization_id;
  clinicalContext.facilityId = user.facility_id;
  clinicalContext.userId = user.user_id;
  clinicalContext.roleId = user.role_assignment_ids[0] ?? '';
}

async function login() {
  if (busy.value) return;
  busy.value = true; message.value = '';
  try {
    await loginClinicalSession(form.username.trim(), form.password);
    applyContext();
    const requested = typeof route.query.redirect === 'string' ? route.query.redirect : '';
    const destination = requested.startsWith('/') && !requested.startsWith('//') && !requested.startsWith('/login')
      ? requested : '/clinical';
    await router.replace(destination);
  } catch (error) {
    message.value = error instanceof Error ? error.message : '登录失败';
  } finally { busy.value = false; }
}

</script>

<template>
  <main data-page-root class="system-login-page vue-native-page">
    <section class="system-login-intro" aria-labelledby="system-name">
      <img
        class="system-login-brand"
        data-testid="system-login-logo"
        src="/brand/haonan-medical-ai-logo.png"
        alt="电子病历系统"
        width="54"
        height="54"
      />
      <p class="system-login-kicker">OpenEMR2026</p>
      <h1 id="system-name">电子病历系统</h1>
      <p>连接门诊、急诊、住院、病历、医疗质量与 AI 医助的统一工作平台。</p>
      <ul>
        <li><span>统一</span>全系统身份与岗位权限</li>
        <li><span>安全</span>会话撤销、失败锁定与全程审计</li>
        <li><span>连续</span>登录后返回原请求的业务页面</li>
        <li><span>AI 协同</span>问答、摘要、风险提醒、任务草拟与专科医助协作</li>
      </ul>
      <section class="system-login-ai-capabilities" aria-label="AI医助能力介绍">
        <div><img src="/brand/ai-medical-assistant-eva.png" alt="" width="38" height="38" /><strong>AI医助 Eva</strong></div>
        <p>结合当前患者、就诊和任务上下文提供辅助；生成结果标明来源，经医务人员确认后才能进入业务流程。</p>
        <div class="system-login-ai-tags"><span>带上下文问答</span><span>主动风险提醒</span><span>医生确认与全程留痕</span></div>
      </section>
      <small>仅限授权人员使用。所有访问和操作均可审计。</small>
    </section>

    <section class="system-login-panel" aria-labelledby="login-title">
      <div class="system-login-heading">
        <span>系统统一身份认证</span>
        <h2 id="login-title">登录电子病历系统</h2>
        <p>请使用您的系统账号继续</p>
      </div>
      <p v-if="message" class="system-login-message" role="alert">{{ message }}</p>
      <form class="system-login-form" @submit.prevent="login">
        <div class="system-login-control"><label for="system-login-username">用户名</label><input id="system-login-username" v-model="form.username" name="username" autocomplete="username" autofocus required placeholder="请输入系统账号" /></div>
        <div class="system-login-control"><label for="system-login-password">密码</label><div class="system-password-field"><input id="system-login-password" v-model="form.password" name="password" :type="passwordVisible ? 'text' : 'password'" autocomplete="current-password" required minlength="8" placeholder="请输入密码" /><button type="button" :aria-label="passwordVisible ? '隐藏密码' : '显示密码'" @click="passwordVisible = !passwordVisible">{{ passwordVisible ? '隐藏' : '显示' }}</button></div></div>
        <button class="system-login-submit" :disabled="busy">{{ busy ? '正在安全验证…' : '登录系统' }}</button>
      </form>
      <div class="system-login-environment">
        <b>开发验收环境</b>
        <dl>
          <div><dt>体验账号</dt><dd><code>linwei</code></dd></div>
          <div><dt>体验密码</dt><dd><code>OpenEMR2026-dev!</code></dd></div>
        </dl>
        <small>完整验收地址 <code>http://127.0.0.1:4177/</code>；需同时运行 <code>8080</code> 后端。仅用于本地开发与验收；部署环境应通过 <code>OPENEMR2026_DEV_LOGIN_PASSWORD</code> 覆盖默认密码。</small>
      </div>
      <footer><span>数据传输加密</span><span>会话服务端撤销</span><span>审计记录留痕</span></footer>
    </section>
  </main>
</template>
