create table specialty_execution_case (
  tenant_id uuid not null,
  specialty_execution_case_id uuid not null,
  business_number varchar(64) not null,
  domain varchar(32) not null check (domain in ('PATHOLOGY','THERAPY','ANESTHESIA','DEVICE_MONITORING')),
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  title varchar(256) not null check (length(trim(title)) >= 2),
  priority varchar(16) not null check (priority in ('ROUTINE','URGENT','EMERGENCY')),
  status varchar(24) not null check (status in ('DRAFT','READY','IN_PROGRESS','PENDING_REVIEW','COMPLETED','CANCELLED')),
  planned_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid not null,
  last_actor_user_id uuid not null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, specialty_execution_case_id),
  unique (tenant_id, business_number),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id, patient_id) references encounter(tenant_id, encounter_id, patient_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, created_by) references app_user(tenant_id, user_id),
  foreign key (tenant_id, last_actor_user_id) references app_user(tenant_id, user_id)
);

create index specialty_execution_case_worklist_idx
  on specialty_execution_case (tenant_id, facility_id, domain, status, planned_at, updated_at desc);
create index specialty_execution_case_patient_idx
  on specialty_execution_case (tenant_id, patient_id, encounter_id, domain, updated_at desc);

create table specialty_execution_case_event (
  tenant_id uuid not null,
  specialty_execution_event_id uuid not null,
  specialty_execution_case_id uuid not null,
  event_type varchar(32) not null check (event_type in ('CREATED','UPDATED','READY','STARTED','REVIEW_REQUESTED','COMPLETED','CANCELLED')),
  from_status varchar(24),
  to_status varchar(24) not null,
  note varchar(1000),
  snapshot jsonb not null,
  actor_user_id uuid not null,
  occurred_at timestamptz not null default now(),
  primary key (tenant_id, specialty_execution_event_id),
  foreign key (tenant_id, specialty_execution_case_id)
    references specialty_execution_case(tenant_id, specialty_execution_case_id),
  foreign key (tenant_id, actor_user_id) references app_user(tenant_id, user_id)
);

create index specialty_execution_case_event_timeline_idx
  on specialty_execution_case_event (tenant_id, specialty_execution_case_id, occurred_at, specialty_execution_event_id);

create function prevent_specialty_execution_event_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'specialty execution case events are immutable';
end $$;

create trigger specialty_execution_case_event_immutable
  before update or delete on specialty_execution_case_event
  for each row execute function prevent_specialty_execution_event_mutation();
