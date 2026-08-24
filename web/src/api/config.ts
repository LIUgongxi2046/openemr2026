import {
  configurationItemDefineRequestWireSchema,
  configurationItemUpdateRequestWireSchema,
  configurationItemWireSchema,
  configurationLifecycleRequestWireSchema,
  type ConfigurationItemWire,
  type ConfigurationLifecycleRequestWire,
  type ContextLeaseWire,
} from '../generated/contracts';
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
