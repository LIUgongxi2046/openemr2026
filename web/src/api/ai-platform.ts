import {
  clinicalContext,
  issueContextLease,
  request,
  wardHeaders,
} from '../clinical-api';
import {
  agentRegistryDeactivateRequestWireSchema,
  agentRegistryRegisterRequestWireSchema,
  agentRegistryWireSchema,
  agentRunBudgetConsumptionRecordRequestWireSchema,
  agentRunBudgetConsumptionWireSchema,
  agentRunBudgetDeactivateRequestWireSchema,
  agentRunBudgetDefineRequestWireSchema,
  agentRunBudgetSummaryWireSchema,
  agentRunBudgetWireSchema,
  aiRunSnapshotWireSchema,
  modelDeploymentDeactivateRequestWireSchema,
  modelDeploymentRegisterRequestWireSchema,
  modelDeploymentWireSchema,
  modelEvaluationRecordRequestWireSchema,
  modelEvaluationWireSchema,
  skillRegistryDeactivateRequestWireSchema,
  skillRegistryRegisterRequestWireSchema,
  skillRegistryWireSchema,
  toolRegistryDeactivateRequestWireSchema,
  toolRegistryRegisterRequestWireSchema,
  toolRegistryWireSchema,
  type AgentRegistryRegisterRequestWire,
  type AgentRegistryWire,
  type AgentRunBudgetConsumptionRecordRequestWire,
  type AgentRunBudgetConsumptionWire,
  type AgentRunBudgetDefineRequestWire,
  type AgentRunBudgetSummaryWire,
  type AgentRunBudgetWire,
  type AIRunSnapshotWire,
  type ContextLeaseWire,
  type ModelDeploymentRegisterRequestWire,
  type ModelDeploymentWire,
  type ModelEvaluationRecordRequestWire,
  type ModelEvaluationWire,
  type SkillRegistryRegisterRequestWire,
  type SkillRegistryWire,
  type ToolRegistryRegisterRequestWire,
  type ToolRegistryWire,
} from '../generated/contracts';

/** AI 平台域为机构-院区级上下文（无患者），签发一次租约后复用。 */
export function issueAiLease(purpose: string): Promise<ContextLeaseWire> {
  return issueContextLease(null, null, purpose);
}

/** Agent 受控运行列表（机构-院区级）。 */
export async function listAiRuns(lease: ContextLeaseWire): Promise<AIRunSnapshotWire[]> {
  return aiRunSnapshotWireSchema.array().parse(await request('/ai/runs', { headers: wardHeaders(lease) }));
}

function orgFacility() {
  return {
    organization_id: clinicalContext.organizationId,
    facility_id: clinicalContext.facilityId,
  };
}

// ── 基座模型目录（Model Deployments） ─────────────────────────
export async function listModelDeployments(lease: ContextLeaseWire): Promise<ModelDeploymentWire[]> {
  return modelDeploymentWireSchema.array().parse(await request('/model-deployments', { headers: wardHeaders(lease) }));
}

export async function registerModelDeployment(
  lease: ContextLeaseWire,
  input: Omit<ModelDeploymentRegisterRequestWire, 'organization_id' | 'facility_id'>,
): Promise<ModelDeploymentWire> {
  return modelDeploymentWireSchema.parse(await request('/model-deployments', {
    method: 'POST',
    headers: { ...wardHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(modelDeploymentRegisterRequestWireSchema.parse({ ...orgFacility(), ...input })),
  }));
}

export async function deactivateModelDeployment(
  lease: ContextLeaseWire,
  model: ModelDeploymentWire,
): Promise<ModelDeploymentWire> {
  return modelDeploymentWireSchema.parse(await request(
    `/model-deployments/${model.model_deployment_id}/deactivations`, {
      method: 'POST',
      headers: { ...wardHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify(modelDeploymentDeactivateRequestWireSchema.parse({
        ...orgFacility(), expected_row_version: model.row_version,
      })),
    },
  ));
}

// ── Agent 目录（Agent Registry） ─────────────────────────────
export async function listAgents(lease: ContextLeaseWire, status?: string): Promise<AgentRegistryWire[]> {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  return agentRegistryWireSchema.array().parse(await request(`/agent-registry${q}`, { headers: wardHeaders(lease) }));
}

export async function registerAgent(
  lease: ContextLeaseWire,
  input: Omit<AgentRegistryRegisterRequestWire, 'organization_id' | 'facility_id'>,
): Promise<AgentRegistryWire> {
  return agentRegistryWireSchema.parse(await request('/agent-registry', {
    method: 'POST',
    headers: { ...wardHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(agentRegistryRegisterRequestWireSchema.parse({ ...orgFacility(), ...input })),
  }));
}

export async function deactivateAgent(
  lease: ContextLeaseWire,
  agent: AgentRegistryWire,
): Promise<AgentRegistryWire> {
  return agentRegistryWireSchema.parse(await request(
    `/agent-registry/${agent.agent_registry_id}/deactivations`, {
      method: 'POST',
      headers: { ...wardHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify(agentRegistryDeactivateRequestWireSchema.parse({ ...orgFacility() })),
    },
  ));
}

// ── Skill 目录（Skill Registry） ─────────────────────────────
export async function listSkills(lease: ContextLeaseWire, status?: string): Promise<SkillRegistryWire[]> {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  return skillRegistryWireSchema.array().parse(await request(`/skill-registry${q}`, { headers: wardHeaders(lease) }));
}

export async function registerSkill(
  lease: ContextLeaseWire,
  input: Omit<SkillRegistryRegisterRequestWire, 'organization_id' | 'facility_id'>,
): Promise<SkillRegistryWire> {
  return skillRegistryWireSchema.parse(await request('/skill-registry', {
    method: 'POST',
    headers: { ...wardHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(skillRegistryRegisterRequestWireSchema.parse({ ...orgFacility(), ...input })),
  }));
}

export async function deactivateSkill(
  lease: ContextLeaseWire,
  skill: SkillRegistryWire,
): Promise<SkillRegistryWire> {
  return skillRegistryWireSchema.parse(await request(
    `/skill-registry/${skill.skill_registry_id}/deactivations`, {
      method: 'POST',
      headers: { ...wardHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify(skillRegistryDeactivateRequestWireSchema.parse({ ...orgFacility() })),
    },
  ));
}

// ── Tool 目录（Tool Registry） ───────────────────────────────
export async function listTools(lease: ContextLeaseWire, status?: string): Promise<ToolRegistryWire[]> {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  return toolRegistryWireSchema.array().parse(await request(`/tool-registry${q}`, { headers: wardHeaders(lease) }));
}

export async function registerTool(
  lease: ContextLeaseWire,
  input: Omit<ToolRegistryRegisterRequestWire, 'organization_id' | 'facility_id'>,
): Promise<ToolRegistryWire> {
  return toolRegistryWireSchema.parse(await request('/tool-registry', {
    method: 'POST',
    headers: { ...wardHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(toolRegistryRegisterRequestWireSchema.parse({ ...orgFacility(), ...input })),
  }));
}

export async function deactivateTool(
  lease: ContextLeaseWire,
  tool: ToolRegistryWire,
): Promise<ToolRegistryWire> {
  return toolRegistryWireSchema.parse(await request(
    `/tool-registry/${tool.tool_registry_id}/deactivations`, {
      method: 'POST',
      headers: { ...wardHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify(toolRegistryDeactivateRequestWireSchema.parse({ ...orgFacility() })),
    },
  ));
}

// ── 模型评估（Model Evaluations） ────────────────────────────
export async function listModelEvaluations(
  lease: ContextLeaseWire,
  modelDeploymentId: string,
): Promise<ModelEvaluationWire[]> {
  return modelEvaluationWireSchema.array().parse(await request(
    `/model-evaluations?model_deployment_id=${encodeURIComponent(modelDeploymentId)}`,
    { headers: wardHeaders(lease) },
  ));
}

export async function recordModelEvaluation(
  lease: ContextLeaseWire,
  input: Omit<ModelEvaluationRecordRequestWire, 'organization_id' | 'facility_id'>,
): Promise<ModelEvaluationWire> {
  return modelEvaluationWireSchema.parse(await request('/model-evaluations', {
    method: 'POST',
    headers: { ...wardHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(modelEvaluationRecordRequestWireSchema.parse({
      ...orgFacility(), ...input, evaluated_at: new Date(input.evaluated_at).toISOString(),
    })),
  }));
}

// ── AI 运行预算（Agent Run Budgets） ─────────────────────────
export async function listAgentRunBudgets(lease: ContextLeaseWire, status?: string): Promise<AgentRunBudgetWire[]> {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  return agentRunBudgetWireSchema.array().parse(await request(`/agent-run-budgets${q}`, { headers: wardHeaders(lease) }));
}

export async function defineAgentRunBudget(
  lease: ContextLeaseWire,
  input: Omit<AgentRunBudgetDefineRequestWire, 'organization_id' | 'facility_id'>,
): Promise<AgentRunBudgetWire> {
  return agentRunBudgetWireSchema.parse(await request('/agent-run-budgets', {
    method: 'POST',
    headers: { ...wardHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(agentRunBudgetDefineRequestWireSchema.parse({ ...orgFacility(), ...input })),
  }));
}

export async function deactivateAgentRunBudget(
  lease: ContextLeaseWire,
  budget: AgentRunBudgetWire,
): Promise<AgentRunBudgetWire> {
  return agentRunBudgetWireSchema.parse(await request(
    `/agent-run-budgets/${budget.budget_id}/deactivations`, {
      method: 'POST',
      headers: { ...wardHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify(agentRunBudgetDeactivateRequestWireSchema.parse({ ...orgFacility() })),
    },
  ));
}

export async function getAgentRunBudgetSummary(
  lease: ContextLeaseWire,
  budgetId: string,
): Promise<AgentRunBudgetSummaryWire> {
  return agentRunBudgetSummaryWireSchema.parse(await request(
    `/agent-run-budget-summaries/${budgetId}`,
    { headers: wardHeaders(lease) },
  ));
}

export async function listAgentRunBudgetConsumptions(
  lease: ContextLeaseWire,
  budgetId: string,
): Promise<AgentRunBudgetConsumptionWire[]> {
  return agentRunBudgetConsumptionWireSchema.array().parse(await request(
    `/agent-run-budget-consumptions?budget_id=${encodeURIComponent(budgetId)}`,
    { headers: wardHeaders(lease) },
  ));
}

export async function recordAgentRunBudgetConsumption(
  lease: ContextLeaseWire,
  input: Omit<AgentRunBudgetConsumptionRecordRequestWire, 'organization_id' | 'facility_id'>,
): Promise<AgentRunBudgetConsumptionWire> {
  return agentRunBudgetConsumptionWireSchema.parse(await request('/agent-run-budget-consumptions', {
    method: 'POST',
    headers: { ...wardHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(agentRunBudgetConsumptionRecordRequestWireSchema.parse({ ...orgFacility(), ...input })),
  }));
}
