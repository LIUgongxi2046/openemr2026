alter table clinical_task_event
  add column target_user_id uuid,
  add column valid_until timestamptz,
  add foreign key (tenant_id, target_user_id) references app_user(tenant_id, user_id);

create table clinical_task_delegation (
  tenant_id uuid not null,
  delegation_id uuid not null,
  task_id uuid not null,
  delegated_by uuid not null,
  delegated_to uuid not null,
  reason varchar(1000) not null check (length(trim(reason)) >= 2),
  valid_until timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, delegation_id),
  foreign key (tenant_id, task_id) references clinical_task(tenant_id, task_id),
  foreign key (tenant_id, delegated_by) references app_user(tenant_id, user_id),
  foreign key (tenant_id, delegated_to) references app_user(tenant_id, user_id),
  check (delegated_by <> delegated_to),
  check (valid_until > created_at)
);

create index clinical_task_delegation_task_idx
  on clinical_task_delegation (tenant_id, task_id, created_at desc);
create index clinical_task_delegation_target_idx
  on clinical_task_delegation (tenant_id, delegated_to, valid_until desc);

create function prevent_clinical_task_delegation_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'clinical task delegations are immutable';
end $$;

create trigger clinical_task_delegation_immutable
  before update or delete on clinical_task_delegation
  for each row execute function prevent_clinical_task_delegation_mutation();

