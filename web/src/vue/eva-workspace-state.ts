export interface EvaWorkspaceQueryState {
  catalogLeasePending: boolean;
  catalogLeaseReady: boolean;
  catalogPending: boolean;
  modelLeasePending: boolean;
  modelLeaseReady: boolean;
  modelsPending: boolean;
  runLeaseEnabled: boolean;
  runLeasePending: boolean;
}

export function isEvaWorkspaceLoading(state: EvaWorkspaceQueryState): boolean {
  return state.catalogLeasePending
    || state.modelLeasePending
    || (state.runLeaseEnabled && state.runLeasePending)
    || (state.catalogLeaseReady && state.catalogPending)
    || (state.modelLeaseReady && state.modelsPending);
}
