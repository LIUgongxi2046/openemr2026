<!-- 模板由脚本生成 -->
<template>
  <section data-page-root class="content vue-native-page">
    <div class="page-head"><div class="page-title"><h1>统一首页与任务中心</h1><p>按角色聚合危急值、审签、会诊、路径和管理任务，正文访问仍按患者/就诊实时鉴权</p></div></div>
    <div class="portal-safety"><b>统一入口</b><span>任务只在首页聚合展示；进入来源页面后，仍按患者、就诊和任务实时鉴权，不以首页权限绕过。</span><span class="status green">核心服务正常</span></div>
    <div class="hub-hero"><div><span>统一首页</span><h2>统一入口，不聚合权限</h2><p>从统一首页进入最高风险任务；正文访问仍按患者/就诊实时鉴权，任务终态由来源业务事实确认。</p></div><div class="hub-score"><b>9</b><span>我的待处理</span></div></div>
    <div class="hub-module-grid">
      <RouterLink class="hub-module" to="/clinical-tasks"><span>☑</span><b>统一临床任务</b><p>危急值、会诊、审签、时限与路径变异</p><i>进入 →</i></RouterLink>
      <RouterLink class="hub-module" to="/clinical"><span>⌂</span><b>临床业务门户</b><p>门诊、急诊、住院三个独立工作域</p><i>进入 →</i></RouterLink>
      <RouterLink class="hub-module" to="/outpatient"><span>◫</span><b>门诊工作台</b><p>当日门诊与病历、医嘱、结果</p><i>进入 →</i></RouterLink>
      <RouterLink class="hub-module" to="/emergency"><span>✚</span><b>急诊工作台</b><p>预检分诊、抢救留观与去向闭环</p><i>进入 →</i></RouterLink>
      <RouterLink class="hub-module" to="/inpatient"><span>▥</span><b>住院工作站</b><p>病区患者、文书任务与出院闭环</p><i>进入 →</i></RouterLink>
      <RouterLink class="hub-module" to="/ward"><span>▦</span><b>病区护理工作台</b><p>交接班与患者级交接清单</p><i>进入 →</i></RouterLink>
    </div>
  </section>
</template>
