create table clinical_task (
  tenant_id uuid not null,
  task_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  source_type varchar(32) not null check (source_type in (
    'ORDER_EXECUTION', 'CRITICAL_VALUE', 'DOCUMENT', 'CONSULTATION',
    'PATHWAY', 'DISCHARGE_REMEDIATION', 'AI_APPROVAL')),
  source_id uuid not null,
  task_type varchar(64) not null,
  title varchar(256) not null check (length(trim(title)) > 0),
  risk_level varchar(16) not null check (risk_level in ('ROUTINE', 'HIGH', 'CRITICAL')),
  state varchar(24) not null check (state in (
    'PENDING', 'ASSIGNED', 'DELIVERED', 'VIEWED', 'CLAIMED', 'IN_PROGRESS',
    'COMPLETED', 'WITHDRAWN', 'EXPIRED', 'ESCALATED')),
  business_state varchar(64) not null,
  assigned_user_id uuid,
  claimed_by uuid,
  due_at timestamptz,
  source_route varchar(256) not null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, task_id),
  unique (tenant_id, source_type, source_id, task_type),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, assigned_user_id) references app_user(tenant_id, user_id),
  foreign key (tenant_id, claimed_by) references app_user(tenant_id, user_id),
  check (state not in ('CLAIMED', 'IN_PROGRESS') or claimed_by is not null)
);

create table clinical_task_event (
  tenant_id uuid not null,
  task_event_id uuid not null,
  task_id uuid not null,
  event_type varchar(32) not null check (event_type in (
    'CREATED', 'ASSIGNED', 'DELIVERED', 'VIEWED', 'CLAIMED', 'STARTED',
    'DELEGATED', 'TRANSFERRED', 'ESCALATED', 'SOURCE_COMPLETED',
    'SOURCE_WITHDRAWN', 'EXPIRED')),
  previous_state varchar(24),
  resulting_state varchar(24) not null,
  actor_user_id uuid not null,
  reason varchar(1000),
  occurred_at timestamptz not null default now(),
  primary key (tenant_id, task_event_id),
  foreign key (tenant_id, task_id) references clinical_task(tenant_id, task_id),
  foreign key (tenant_id, actor_user_id) references app_user(tenant_id, user_id)
);

create index clinical_task_encounter_state_idx
  on clinical_task (tenant_id, encounter_id, state, risk_level, due_at, created_at);
create index clinical_task_claimed_idx
  on clinical_task (tenant_id, claimed_by, state, updated_at desc)
  where claimed_by is not null;

create function prevent_clinical_task_event_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'clinical task events are immutable';
end $$;

create trigger clinical_task_event_immutable
  before update or delete on clinical_task_event
  for each row execute function prevent_clinical_task_event_mutation();

