<script setup lang="ts">
const modules = [
  { icon: '接', title: '集成交换', description: 'LIS、PACS、HIS、CA、医保与消息对账', to: '/integration' },
  { icon: '迁', title: '历史迁移', description: '画像、映射、试迁移、增量、切换和回退', to: '/migration' },
  { icon: '质', title: '数据质量', description: 'MPI、关联、单位、迟到、隔离与整改', to: '/data-quality' },
  { icon: '备', title: '设备接入', description: '目录、网关、可信状态、绑定和时钟质量', to: '/devices' },
  { icon: '研', title: '科研统计', description: '项目、队列、统计、脱敏和受控交付', to: '/research' },
] as const;
</script>

<template>
  <section data-page-root class="content vue-native-page">
    <div class="page-head">
      <div class="page-title">
        <h1>数据中心</h1>
        <p>统一数据接入、迁移、质量、设备、标准化与科研利用</p>
      </div>
      <div class="head-actions">
        <RouterLink class="btn" to="/admin-roles">角色工作台</RouterLink>
        <RouterLink class="btn primary" to="/clinical-tasks">查看全部待办</RouterLink>
      </div>
    </div>

    <section class="hub-hero" aria-label="数据中心治理摘要">
      <div>
        <span>TRUSTED DATA CENTER</span>
        <h2>技术消息、临床对象、数据质量和利用授权在同一治理链上可追溯</h2>
        <p>数据中心不成为绕过临床权限的超级入口；每个页面继续执行患者关系、项目用途、最小字段和导出审批。</p>
      </div>
      <div class="hub-score"><b>99.93%</b><span>核心对象一致性</span></div>
    </section>

    <nav class="hub-module-grid data-center-module-grid" aria-label="数据中心功能入口">
      <RouterLink v-for="item in modules" :key="item.to" class="hub-module" :to="item.to">
        <span>{{ item.icon }}</span>
        <b>{{ item.title }}</b>
        <p>{{ item.description }}</p>
        <i>进入 →</i>
      </RouterLink>
    </nav>
  </section>
</template>

<style scoped>
.data-center-module-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.hub-hero h2, .hub-hero p { color: #fff; }
.hub-hero > div > span { color: #dbeafe; }
.hub-module { color: inherit; text-decoration: none; }
@media (max-width: 1200px) { .data-center-module-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 760px) { .data-center-module-grid { grid-template-columns: minmax(0, 1fr); } }
</style>
