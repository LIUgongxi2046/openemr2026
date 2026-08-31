alter table clinical_task
  add column task_rule_config_id uuid,
  add column task_rule_version bigint,
  add column rule_snapshot jsonb not null default '{}'::jsonb,
  add column escalation_at timestamptz,
  add constraint clinical_task_rule_reference_check
    check ((task_rule_config_id is null) = (task_rule_version is null)),
  add constraint clinical_task_rule_version_check
    check (task_rule_version is null or task_rule_version > 0),
  add foreign key (tenant_id, task_rule_config_id)
    references config_item(tenant_id, config_id);

create index clinical_task_escalation_due_idx
  on clinical_task(tenant_id, state, escalation_at, due_at)
  where state not in ('COMPLETED', 'WITHDRAWN', 'EXPIRED');

comment on column clinical_task.rule_snapshot is
  'Immutable-at-creation task SLA/assignment snapshot resolved from an ACTIVE approved task rule.';

alter table clinical_pathway_version
  add column source_config_id uuid,
  add column source_config_version bigint,
  add constraint clinical_pathway_config_reference_check
    check ((source_config_id is null) = (source_config_version is null)),
  add foreign key (tenant_id, source_config_id)
    references config_item(tenant_id, config_id);

create unique index clinical_pathway_source_config_idx
  on clinical_pathway_version(tenant_id, source_config_id, source_config_version)
  where source_config_id is not null;
