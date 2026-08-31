import { describe, expect, it } from 'vitest';

import { isEvaWorkspaceLoading, type EvaWorkspaceQueryState } from './eva-workspace-state';

const ready: EvaWorkspaceQueryState = {
  catalogLeasePending: false,
  catalogLeaseReady: true,
  catalogPending: false,
  modelLeasePending: false,
  modelLeaseReady: true,
  modelsPending: false,
  runLeaseEnabled: true,
  runLeasePending: false,
};

describe('Eva workspace loading state', () => {
  it('stops loading when a lease failed and its dependent query stayed disabled', () => {
    expect(isEvaWorkspaceLoading({
      ...ready,
      catalogLeaseReady: false,
      catalogPending: true,
    })).toBe(false);
  });

  it('waits for active lease and dependent resource requests', () => {
    expect(isEvaWorkspaceLoading({ ...ready, catalogLeasePending: true })).toBe(true);
    expect(isEvaWorkspaceLoading({ ...ready, catalogPending: true })).toBe(true);
    expect(isEvaWorkspaceLoading({ ...ready, modelLeasePending: true })).toBe(true);
    expect(isEvaWorkspaceLoading({ ...ready, modelsPending: true })).toBe(true);
    expect(isEvaWorkspaceLoading({ ...ready, runLeasePending: true })).toBe(true);
  });

  it('finishes when all workspace dependencies settled', () => {
    expect(isEvaWorkspaceLoading(ready)).toBe(false);
  });

  it('does not wait on a disabled patient lease before a patient is selected', () => {
    expect(isEvaWorkspaceLoading({ ...ready, runLeaseEnabled: false, runLeasePending: true })).toBe(false);
  });
});
