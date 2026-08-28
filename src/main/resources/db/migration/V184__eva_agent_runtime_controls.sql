alter table medical_agent_run
  add column model_deployment_id uuid,
  add column authorization_level varchar(16) not null default 'STANDARD'
    check (authorization_level in ('READ_ONLY', 'STANDARD', 'EXTENDED')),
  add column context_scopes jsonb not null
    default '["RECORDS", "ORDERS", "RESULTS", "TASKS"]'::jsonb,
  add constraint medical_agent_run_model_deployment_fk
    foreign key (tenant_id, model_deployment_id)
    references model_deployment(tenant_id, model_deployment_id),
  add constraint medical_agent_run_context_scopes_array
    check (jsonb_typeof(context_scopes) = 'array' and jsonb_array_length(context_scopes) > 0);

create index medical_agent_run_model_idx
  on medical_agent_run(tenant_id, model_deployment_id, created_at desc)
  where model_deployment_id is not null;

update config_item
set display_name = replace(display_name, 'AI医助小南', 'AI医助 Eva'),
    payload = replace(payload::text, '小南', 'Eva')::jsonb,
    updated_at = now(),
    row_version = row_version + 1
where config_type in ('AI_ASSISTANT_POLICY', 'AGENT_COMPOSITION')
  and (display_name like '%小南%' or payload::text like '%小南%');
