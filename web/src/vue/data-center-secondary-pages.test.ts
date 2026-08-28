import { describe, expect, it } from 'vitest';

const views = import.meta.glob('./views/*.vue', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const components = import.meta.glob('./components/*.vue', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

describe('数据中心六个二级页面契约', () => {
  it('数据总览保留全部五个下游模块入口', () => {
    const source = views['./views/DataCenterPage.vue'];
    for (const route of ['/integration', '/migration', '/data-quality', '/devices', '/research']) {
      expect(source).toContain(route);
    }
  });

  it('集成交换提供连接测试和互操作处置入口', () => {
    const source = views['./views/IntegrationPage.vue'];
    expect(source).toContain('invokeMockInterface');
    expect(source).toContain("listConfigurations(configLeaseQuery.data.value!, 'INTEGRATION_CONNECTOR')");
    expect(source).toContain("listConfigurations(configLeaseQuery.data.value!, 'INTEGRATION_INCIDENT')");
    expect(source).toContain('连接测试');
    expect(source).toContain('/integration-connectors');
    expect(source).toContain('/integration-messages');
    expect(source).not.toContain("const systemMeta");
    expect(source).not.toContain('82,830');
  });

  it('历史迁移覆盖八阶段、完整流程动作和弹窗交互', () => {
    const source = views['./views/MigrationPage.vue'];
    for (const action of [
      'registerSourceSystem', 'registerSourceFieldMapping', 'recordSourcePatientMatchCandidate',
      'startHistoricalMigrationBatch', 'reconcileHistoricalMigrationBatch',
      'switchHistoricalMigrationBatch', 'rollbackHistoricalMigrationBatch',
      'recordHistoricalMigrationCheckpoint',
    ]) expect(source).toContain(action);
    expect(source).toContain("['源盘点', '字段映射', '患者匹配', '试迁', '对账', '切换', '观察', '归档']");
    expect(source).toContain('exportReconciliationReport');
    expect(source.match(/<AdminActionDialog/g)?.length).toBeGreaterThanOrEqual(4);
    expect(source).toContain('<AdminConfirmDialog');
  });

  it('数据质量覆盖问题队列、整改流、规则评估和停用确认', () => {
    const source = views['./views/DataQualityPage.vue'];
    expect(source).toContain('质量问题工作队列');
    expect(source).toContain('发现</li><li>分派</li><li>整改</li><li>复核</li><li>关闭');
    expect(source).toContain('registerDataQualityRule');
    expect(source).toContain('recordDataQualityEvaluation');
    expect(source).toContain('deactivateDataQualityRule');
    expect(source).toContain('<AdminActionDialog');
    expect(source).toContain('<AdminConfirmDialog');
  });

  it('设备接入和科研统计使用真实版本化 CRUD 目录', () => {
    const catalog = components['./components/DataCenterConfigurationCatalog.vue'];
    expect(catalog).toContain('defineConfiguration');
    expect(catalog).toContain('updateConfiguration');
    expect(catalog).toContain('transitionConfiguration');
    expect(catalog).toContain('...(selected.value?.payload ?? {})');
    expect(catalog).toContain('<AdminActionDialog');
    expect(catalog).toContain('<AdminConfirmDialog');
    expect(views['./views/DevicesPage.vue']).toContain("configType: 'DEVICE_CATALOG'");
    expect(views['./views/ResearchPage.vue']).toContain("configType: 'RESEARCH_PROJECT'");
    const stats = views['./views/ResearchStatsPage.vue'];
    expect(stats).toContain("item.dimension?.group === 'AGE_DISTRIBUTION'");
    expect(stats).toContain("item.dimension?.group === 'TREND'");
    expect(stats).not.toContain('const ages = [');
    expect(stats).not.toContain('STAT-20260813-09');
  });

  it('目录卡片限制宽度并保持紧凑操作间距', () => {
    const catalog = components['./components/DataCenterConfigurationCatalog.vue'];
    expect(catalog).toContain('minmax(288px, 350px)');
    expect(catalog).toContain('gap: 14px');
    expect(catalog).toContain('.catalog-actions { display: flex; flex-wrap: wrap; gap: 10px;');
  });
});
