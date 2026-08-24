import { describe, expect, it } from 'vitest';

import { decodeAiRunEvent, OrderedAiEventGate } from './contract-codec';

const runId = '018f0000-0000-7000-8000-000000000701';
const leaseId = '018f0000-0000-7000-8000-000000000702';
const event = (sequence: number) => ({
  schema_version: 1,
  event_id: `event-${sequence}`,
  run_id: runId,
  sequence,
  event_type: 'RUN_STATE_CHANGED',
  state: 'RUNNING',
  occurred_at: '2026-08-20T05:00:00Z',
  data_watermark: 'synthetic-watermark',
  context_lease_id: leaseId,
  payload: {},
});

describe('generated AI event codec', () => {
  it('rejects an unknown schema version instead of merging it', () => {
    expect(() => decodeAiRunEvent({ ...event(1), schema_version: 2 })).toThrow();
  });

  it('deduplicates events and requires a snapshot for a sequence gap', () => {
    const gate = new OrderedAiEventGate(runId, leaseId);
    expect(gate.accept(event(1))).toBe('APPLIED');
    expect(gate.accept(event(1))).toBe('DUPLICATE');
    expect(gate.accept(event(3))).toBe('SNAPSHOT_REQUIRED');
    expect(gate.lastSequence).toBe(1);
    expect(gate.accept(event(2))).toBe('APPLIED');
  });

  it('rejects an event from another clinical context', () => {
    const gate = new OrderedAiEventGate(runId, leaseId);
    expect(gate.accept({ ...event(1), context_lease_id: '018f0000-0000-7000-8000-000000000703' })).toBe('WRONG_CONTEXT');
  });
});
