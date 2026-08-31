import {
  configurationItemDefineRequestWireSchema,
  configurationItemUpdateRequestWireSchema,
  configurationItemWireSchema,
  configurationLifecycleRequestWireSchema,
  configurationRevisionWireSchema,
  configurationRuntimeEvidenceWireSchema,
  type ConfigurationItemWire,
  type ConfigurationRevisionWire,
  type ConfigurationRuntimeEvidenceWire,
  type ConfigurationLifecycleRequestWire,
  type ContextLeaseWire,
} from '../generated/contracts';
import { z } from 'zod';
import { issueContextLease, request, wardHeaders } from '../clinical-api';

export function issueConfigurationLease(): Promise<ContextLeaseWire> {
  return issueContextLease(null, null, 'CONFIGURATION');
}

export async function listConfigurations(lease: ContextLeaseWire, configType: string): Promise<ConfigurationItemWire[]> {
  return configurationItemWireSchema.array().parse(await request(
    `/configurations?config_type=${encodeURIComponent(configType)}`,
    { headers: wardHeaders(lease) },
  ));
}

export async function getConfiguration(lease: ContextLeaseWire, configId: string): Promise<ConfigurationItemWire> {
  return configurationItemWireSchema.parse(await request(`/configurations/${encodeURIComponent(configId)}`, {
    headers: wardHeaders(lease),
  }));
}

export async function listConfigurationRevisions(
  lease: ContextLeaseWire, configId: string,
): Promise<ConfigurationRevisionWire[]> {
  return configurationRevisionWireSchema.array().parse(await request(
    `/configurations/${encodeURIComponent(configId)}/revisions`, { headers: wardHeaders(lease) },
  ));
}

export async function defineConfiguration(
  lease: ContextLeaseWire,
  input: { config_type: string; config_key: string; display_name: string; payload: Record<string, unknown> },
): Promise<ConfigurationItemWire> {
  return configurationItemWireSchema.parse(await request('/configurations', {
    method: 'POST',
    headers: { ...wardHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(configurationItemDefineRequestWireSchema.parse(input)),
  }));
}

export async function updateConfiguration(
  lease: ContextLeaseWire,
  configId: string,
  input: { display_name: string; payload: Record<string, unknown>; expected_version: number },
): Promise<ConfigurationItemWire> {
  return configurationItemWireSchema.parse(await request(`/configurations/${encodeURIComponent(configId)}`, {
    method: 'PUT',
    headers: { ...wardHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(configurationItemUpdateRequestWireSchema.parse(input)),
  }));
}

export async function transitionConfiguration(
  lease: ContextLeaseWire,
  configId: string,
  input: ConfigurationLifecycleRequestWire,
): Promise<ConfigurationItemWire> {
  return configurationItemWireSchema.parse(await request(`/configurations/${encodeURIComponent(configId)}/lifecycle`, {
    method: 'POST',
    headers: { ...wardHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(configurationLifecycleRequestWireSchema.parse(input)),
  }));
}

const runtimeExecutionSchema = z.object({
  execution_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  facility_id: z.string().uuid(),
  patient_id: z.string().uuid().nullable().optional(),
  encounter_id: z.string().uuid().nullable().optional(),
  config_id: z.string().uuid(),
  config_type: z.string(),
  config_key: z.string(),
  config_row_version: z.number().int().positive(),
  operation: z.string(),
  subject_type: z.string().nullable().optional(),
  subject_id: z.string().uuid().nullable().optional(),
  state: z.string(),
  current_node: z.string().nullable().optional(),
  input_payload: z.record(z.string(), z.unknown()),
  output_payload: z.record(z.string(), z.unknown()),
  configuration_watermark: z.string(),
  executed_by: z.string().uuid(),
  row_version: z.number().int().positive(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type ConfigurationRuntimeExecution = z.infer<typeof runtimeExecutionSchema>;

function runtimeCommand(lease: ContextLeaseWire, path: string, body: Record<string, unknown>) {
  return request(path, {
    method: 'POST',
    headers: { ...wardHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(body),
  }).then(value => runtimeExecutionSchema.parse(value));
}

export function startConfigurationWorkflow(
  lease: ContextLeaseWire, configKey: string, facts: Record<string, unknown>,
): Promise<ConfigurationRuntimeExecution> {
  return runtimeCommand(lease, `/configuration-runtime/workflows/${encodeURIComponent(configKey)}/instances`, { facts });
}

export function transitionConfigurationWorkflow(
  lease: ContextLeaseWire, execution: ConfigurationRuntimeExecution, eventCode: string, facts: Record<string, unknown>,
): Promise<ConfigurationRuntimeExecution> {
  return runtimeCommand(lease, `/configuration-runtime/workflows/instances/${encodeURIComponent(execution.execution_id)}/transitions`, {
    expected_version: execution.row_version, event_code: eventCode, facts,
  });
}

export function validateConfigurationForm(
  lease: ContextLeaseWire, configKey: string, values: Record<string, unknown>,
): Promise<ConfigurationRuntimeExecution> {
  return runtimeCommand(lease, `/configuration-runtime/forms/${encodeURIComponent(configKey)}/validate`, { facts: values });
}

export function evaluateConfigurationRules(
  lease: ContextLeaseWire, configKey: string, facts: Record<string, unknown>,
): Promise<ConfigurationRuntimeExecution> {
  return runtimeCommand(lease, `/configuration-runtime/rules/${encodeURIComponent(configKey)}/evaluate`, { facts });
}

export function authorizeConfigurationScope(
  lease: ContextLeaseWire, configKey: string, facts: Record<string, unknown>,
): Promise<ConfigurationRuntimeExecution> {
  return runtimeCommand(lease, `/configuration-runtime/scopes/${encodeURIComponent(configKey)}/authorize`, { facts });
}

export async function listConfigurationRuntimeExecutions(
  lease: ContextLeaseWire, configType: string, configKey: string,
): Promise<ConfigurationRuntimeExecution[]> {
  const query = new URLSearchParams({ config_type: configType, config_key: configKey });
  return runtimeExecutionSchema.array().parse(await request(`/configuration-runtime/executions?${query.toString()}`, {
    headers: wardHeaders(lease),
  }));
}

export async function getConfigurationRuntimeExecution(
  lease: ContextLeaseWire, executionId: string,
): Promise<ConfigurationRuntimeExecution> {
  return runtimeExecutionSchema.parse(await request(
    `/configuration-runtime/executions/${encodeURIComponent(executionId)}`, { headers: wardHeaders(lease) },
  ));
}

export async function listConfigurationRuntimeEvidence(
  lease: ContextLeaseWire, executionId: string,
): Promise<ConfigurationRuntimeEvidenceWire[]> {
  return configurationRuntimeEvidenceWireSchema.array().parse(await request(
    `/configuration-runtime/executions/${encodeURIComponent(executionId)}/evidence`, { headers: wardHeaders(lease) },
  ));
}
