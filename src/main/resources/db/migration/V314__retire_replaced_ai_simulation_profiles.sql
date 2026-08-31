-- These workbenches now read real model, medical-agent and audit records.
-- Preserve historical revisions while removing the obsolete synthetic profiles from active use.
update config_item
set status = 'ARCHIVED', published_at = null,
    row_version = row_version + 1, updated_at = now()
where config_type = 'MOCK_INTERFACE_PROFILE'
  and status <> 'ARCHIVED'
  and coalesce(payload->>'workbench_id', '') in (
    'ai-capture', 'model-connection', 'model-routing'
  );
