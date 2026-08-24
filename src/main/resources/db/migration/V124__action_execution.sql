create table action_execution (
  tenant_id uuid not null,
  execution_id uuid not null,
  action_approval_id uuid not null,
  patient_id uuid not null,
  execution_status varchar(16) not null check (execution_status in ('PENDING', 'SUCCEEDED', 'FAILED')),
  executed_by uuid,
  executed_at timestamptz,
  result_note varchar(1000),
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  primary key (tenant_id, execution_id),
  unique (tenant_id, action_approval_id),
  constraint action_execution_status_check
    check ((execution_status in ('SUCCEEDED', 'FAILED')) = (executed_at is not null and executed_by is not null)),
  constraint action_execution_failure_check
    check (execution_status <> 'FAILED' or (result_note is not null and length(trim(result_note)) >= 2)),
  foreign key (tenant_id, action_approval_id) references action_approval(tenant_id, action_approval_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, executed_by) references app_user(tenant_id, user_id)
);

create index action_execution_approval_idx
  on action_execution (tenant_id, action_approval_id, execution_status);

create function prevent_action_execution_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'action execution identity is immutable once created';
end $$;

create trigger action_execution_immutable
  before update of action_approval_id, patient_id
  on action_execution
  for each row execute function prevent_action_execution_mutation();
