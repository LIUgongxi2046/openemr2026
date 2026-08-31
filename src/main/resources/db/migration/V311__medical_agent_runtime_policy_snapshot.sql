alter table medical_agent_run
  add column if not exists assistant_policy_config_id uuid,
  add column if not exists assistant_policy_row_version bigint,
  add column if not exists assistant_policy_hash char(64),
  add column if not exists assistant_policy_environment varchar(64);

do $$
begin
  if not exists (select 1 from pg_constraint
      where conname = 'medical_agent_run_assistant_policy_fk') then
    alter table medical_agent_run
      add constraint medical_agent_run_assistant_policy_fk
      foreign key (tenant_id, assistant_policy_config_id)
      references config_item(tenant_id, config_id);
  end if;
  if not exists (select 1 from pg_constraint
      where conname = 'medical_agent_run_assistant_policy_snapshot_check') then
    alter table medical_agent_run
      add constraint medical_agent_run_assistant_policy_snapshot_check check (
        (assistant_policy_config_id is null and assistant_policy_row_version is null
          and assistant_policy_hash is null and assistant_policy_environment is null)
        or (assistant_policy_config_id is not null and assistant_policy_row_version > 0
          and assistant_policy_hash ~ '^[0-9a-f]{64}$'
          and length(trim(assistant_policy_environment)) > 0)
      );
  end if;
end $$;

create index if not exists medical_agent_run_policy_idx
  on medical_agent_run(tenant_id, assistant_policy_config_id, created_at desc)
  where assistant_policy_config_id is not null;

comment on column medical_agent_run.assistant_policy_hash is
  '创建 Agent 任务时实际应用的 ACTIVE AI_ASSISTANT_POLICY payload SHA-256，用于评测和审计重放。';
