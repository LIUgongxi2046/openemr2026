import { aiRunWireEventWireSchema, type AIRunWireEventWire } from '../generated/contracts';

export function decodeAiRunEvent(input: unknown): AIRunWireEventWire {
  return aiRunWireEventWireSchema.parse(input);
}

export type EventGateResult = 'APPLIED' | 'DUPLICATE' | 'SNAPSHOT_REQUIRED' | 'WRONG_CONTEXT';

export class OrderedAiEventGate {
  #lastSequence: number;

  constructor(
    private readonly runId: string,
    private readonly contextLeaseId: string,
    initialSequence = 0,
  ) {
    this.#lastSequence = initialSequence;
  }

  accept(input: unknown): EventGateResult {
    const event = decodeAiRunEvent(input);
    if (event.run_id !== this.runId || event.context_lease_id !== this.contextLeaseId) return 'WRONG_CONTEXT';
    if (event.sequence <= this.#lastSequence) return 'DUPLICATE';
    if (event.sequence !== this.#lastSequence + 1) return 'SNAPSHOT_REQUIRED';
    this.#lastSequence = event.sequence;
    return 'APPLIED';
  }

  get lastSequence() {
    return this.#lastSequence;
  }
}
