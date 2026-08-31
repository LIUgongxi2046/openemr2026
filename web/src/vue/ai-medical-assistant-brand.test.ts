import { describe, expect, it } from 'vitest';
import { doctorFacingAiText, doctorFacingTeamName } from './medical-ai-terminology';

const components = import.meta.glob('./components/*.vue', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const views = import.meta.glob('./views/*.vue', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const configurationStudios = import.meta.glob('./configuration-studios.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const deprecatedNames = [
  ['随行', ' AI ', '助', '手'].join(''),
  ['随行', ' AI'].join(''),
  ['AI ', '随行', '助', '手'].join(''),
  ['临床', ' AI ', '助', '手'].join(''),
  ['AI', ' ', '助', '手'].join(''),
];

describe('AI医助 Eva 品牌契约', () => {
  it('normalizes legacy platform terms returned by existing data', () => {
    expect(doctorFacingTeamName('就诊摘要主 Agent')).toBe('就诊摘要');
    expect(doctorFacingAiText('主 Agent 已汇总 3 个子 Agent，协作者等待处理')).toBe('医助团队 已汇总 3 个专科医助，医助等待处理');
    expect(doctorFacingAiText('形成连续照护候选')).toBe('形成连续照护草稿');
    expect(doctorFacingAiText('DeepSeek Harness / ContextLease / 候选制')).toBe('DeepSeek 医助协同引擎 / 诊疗范围授权 / 医生确认机制');
  });

  it('uses the mascot and canonical name in the global entry and dialog', () => {
    const shell = components['./components/ClinicalShell.vue'];
    const dialog = components['./components/GlobalAiAssistantDialog.vue'];

    expect(shell).toContain('打开AI医助Eva');
    expect(shell).toContain('/brand/ai-medical-assistant-eva.png');
    expect(dialog).toContain('id="global-ai-dialog-title">AI医助 Eva</h2>');
    expect(dialog).toContain('/brand/ai-medical-assistant-eva.png');
    expect(dialog).toContain('class="global-ai-mascot"');
  });

  it('introduces AI capabilities on login and the clinical home, and exposes the local experience account', () => {
    const login = views['./views/LoginContextPage.vue'];
    const clinicalHome = views['./views/ClinicalPortalPage.vue'];

    expect(login).toContain('AI医助能力介绍');
    expect(login).toContain('带上下文问答');
    expect(login).toContain('医生确认与全程留痕');
    expect(login).toContain('<code>linwei</code>');
    expect(login).toContain('<code>OpenEMR2026-dev!</code>');
    expect(clinicalHome).toContain('AI医助 Eva 随诊协同');
    expect(clinicalHome).toContain('上下文问答与摘要');
    expect(clinicalHome).toContain('主动风险提醒');
    expect(clinicalHome).toContain('data-route-target="ai-assistant"');
  });

  it('keeps governance terminology out of the clinician dialog', () => {
    const dialog = components['./components/GlobalAiAssistantDialog.vue'];
    const teamRail = components['./components/XiaonanAgentTeamRail.vue'];
    const template = dialog.slice(dialog.indexOf('<template>'));

    expect(teamRail).toContain('医助团队');
    expect(template).toContain('位医助');
    expect(template).toContain('描述需要完成的诊疗任务');
    expect(template).not.toContain('安全边界');
    expect(template).not.toContain('A1 候选制');
    expect(template).not.toContain('ContextLease');
    expect(template).not.toContain('route {{ routeId }}');
    expect(template).not.toContain('Agent 治理 →');
  });

  it('keeps implementation terminology out of the full Eva workspace', () => {
    const page = views['./views/AiAssistantPage.vue'];
    const template = page.slice(page.indexOf('<template>'));

    expect(template).toContain('医助团队');
    expect(page).toContain('Eva 正在规划任务');
    expect(template).toContain('class="eva-inline-events"');
    expect(template).toContain('<EvaComposerControls');
    expect(template).toContain('<EvaPatientPicker');
    expect(template).not.toContain('读取诊疗数据');
    expect(template).not.toContain('收起处理过程');
    expect(template).not.toContain('操作确认');
    expect(template).not.toContain('DETERMINISTIC_FAKE');
    expect(template).not.toContain('Medical Harness');
    expect(template).not.toContain('ContextLease');
    expect(template).not.toContain('候选制');
    expect(template).not.toContain('主子 Agent');
  });

  it('gives both Eva composers a stable accessible name', () => {
    const dialog = components['./components/GlobalAiAssistantDialog.vue'];
    const workspace = views['./views/AiAssistantPage.vue'];

    expect(dialog).toContain('aria-label="向 Eva 描述诊疗任务"');
    expect(workspace).toContain('aria-label="向 Eva 描述诊疗任务"');
  });

  it('uses real model and run APIs for AI center operational drill-downs', () => {
    const connection = views['./views/ModelConnectionPage.vue'];
    const routing = views['./views/ModelRoutingPage.vue'];
    const operations = views['./views/AiOpsPage.vue'];
    const capture = views['./views/AiCapturePage.vue'];

    expect(connection).toContain('testModelDeploymentConnection');
    expect(connection).not.toContain('SimulationWorkbenchPage');
    expect(routing).toContain('listModelDataProcessingApprovals');
    expect(routing).not.toContain('SimulationWorkbenchPage');
    expect(operations).toContain('listMedicalAgentOperationsRuns');
    expect(operations).toContain('listMedicalAgentOperationsToolInvocations');
    expect(operations).toContain('患者身份不在管理页展示');
    expect(capture).toContain('listMedicalAgentOperationsRuns');
    expect(capture).toContain('listMedicalAgentOperationsToolInvocations');
    expect(capture).toContain('listAuditEvents');
    expect(capture).not.toContain('SimulationWorkbenchPage');
  });

  it('uses Chinese hospital terminology across every AI assistant module', () => {
    const surfaces = [
      components['./components/GlobalAiAssistantDialog.vue'].slice(components['./components/GlobalAiAssistantDialog.vue'].indexOf('<template>')),
      views['./views/AiCenterPage.vue'],
      views['./views/AiAssistantPage.vue'].slice(views['./views/AiAssistantPage.vue'].indexOf('<template>')),
      views['./views/AgentCatalogPage.vue'].slice(views['./views/AgentCatalogPage.vue'].indexOf('<template>')),
      views['./views/AgentRunPage.vue'].slice(views['./views/AgentRunPage.vue'].indexOf('<template>')),
      views['./views/SkillCatalogPage.vue'].slice(views['./views/SkillCatalogPage.vue'].indexOf('<template>')),
      views['./views/ToolCatalogPage.vue'].slice(views['./views/ToolCatalogPage.vue'].indexOf('<template>')),
      views['./views/AiOpsPage.vue'].slice(views['./views/AiOpsPage.vue'].indexOf('<template>')),
      views['./views/AiActionReviewPage.vue'].slice(views['./views/AiActionReviewPage.vue'].indexOf('<template>')),
    ].join('\n');

    for (const term of ['协作者', '主 Agent', '子 Agent', 'Agent 设计', 'Agent 运行', 'Skill 目录', 'Tool 目录', 'Harness', 'ContextLease', '候选制', 'Token 消耗', 'AI 提出的高风险动作']) {
      expect(surfaces).not.toContain(term);
    }
    expect(surfaces).toContain('医助团队');
    expect(surfaces).toContain('专科医助');
    expect(surfaces).toContain('医助能力库');
    expect(surfaces).toContain('医助工具库');
    expect(configurationStudios['./configuration-studios.ts']).toContain("title: '医助评测与发布审核'");
    expect(configurationStudios['./configuration-studios.ts']).toContain("title: '医助诊疗范围策略'");
  });

  it('does not regress to deprecated user-facing assistant names', () => {
    const source = Object.values({ ...components, ...views }).join('\n');
    for (const name of deprecatedNames) expect(source).not.toContain(name);
  });

  it('shows clickable question examples for Eva, every medical assistant and each selected task', () => {
    const dialog = components['./components/GlobalAiAssistantDialog.vue'];
    const workspace = views['./views/AiAssistantPage.vue'];
    const teamRail = components['./components/XiaonanAgentTeamRail.vue'];
    const catalog = views['./views/AgentCatalogPage.vue'];

    expect(dialog).toContain('<XiaonanAgentTeamRail');
    expect(workspace).toContain('<XiaonanAgentTeamRail');
    expect(teamRail).toContain('主医助示例');
    expect(teamRail).toContain('child.question_examples');
    expect(catalog).toContain('医生可以这样问');
    expect(catalog).toContain('child.question_examples');
  });

  it('provides a safe model API configuration entry in AI center model services', () => {
    const models = views['./views/ModelDeploymentPage.vue'];

    expect(models).toContain('模型服务与 API 配置');
    expect(models).toContain('AI 中心 → 模型服务 → 登记模型 API');
    expect(models).toContain('<span>API Key</span>');
    expect(models).toContain("type=\"showApiKey ? 'text' : 'password'\"");
    expect(models).toContain('保存后只显示末四位');
  });

  it('derives AI center availability from live model and assistant catalog queries', () => {
    const center = views['./views/AiCenterPage.vue'];

    expect(center).toContain("listModelDeployments");
    expect(center).toContain("listMedicalAgentCatalog");
    expect(center).toContain('AI 服务暂不可用');
    expect(center).not.toContain('服务运行正常');
  });
});
