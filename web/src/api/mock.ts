import {
  mockInterfaceWireSchema,
  mockInvocationResultWireSchema,
  type ContextLeaseWire,
  type MockInterfaceWire,
  type MockInvocationResultWire,
} from '../generated/contracts';
import { issueContextLease, request, wardHeaders } from '../clinical-api';

export function issueMockLease(): Promise<ContextLeaseWire> {
  return issueContextLease(null, null, 'MOCK_INTERFACE');
}

export async function listMockInterfaces(lease: ContextLeaseWire): Promise<MockInterfaceWire[]> {
  return mockInterfaceWireSchema.array().parse(await request('/mock-interfaces', { headers: wardHeaders(lease) }));
}

export async function invokeMockInterface(
  lease: ContextLeaseWire,
  code: string,
  payload: Record<string, unknown> = {},
): Promise<MockInvocationResultWire> {
  return mockInvocationResultWireSchema.parse(await request(`/mock-interfaces/${encodeURIComponent(code)}/invoke`, {
    method: 'POST',
    headers: { ...wardHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(payload),
  }));
}
