create table emergency_coordination_case (
  tenant_id uuid not null,
  coordination_case_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  case_type varchar(24) not null check (case_type in ('CONSULTATION', 'HANDOFF', 'TRANSFER')),
  priority varchar(16) not null check (priority in ('IMMEDIATE', 'URGENT', 'ROUTINE')),
  target_unit varchar(256) not null,
  requested_to uuid,
  summary varchar(4000) not null,
  risk_summary varchar(4000) not null,
  due_at timestamptz not null,
  status varchar(24) not null check (status in ('OPEN', 'ACKNOWLEDGED', 'COMPLETED', 'VOIDED')),
  requested_by uuid not null,
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  completed_by uuid,
  completed_at timestamptz,
  voided_by uuid,
  voided_at timestamptz,
  void_reason varchar(1000),
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, coordination_case_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, requested_by) references app_user(tenant_id, user_id),
  foreign key (tenant_id, requested_to) references app_user(tenant_id, user_id),
  foreign key (tenant_id, acknowledged_by) references app_user(tenant_id, user_id),
  foreign key (tenant_id, completed_by) references app_user(tenant_id, user_id),
  foreign key (tenant_id, voided_by) references app_user(tenant_id, user_id),
  check (length(trim(target_unit)) >= 2),
  check (length(trim(summary)) >= 2),
  check (length(trim(risk_summary)) >= 2),
  check (status not in ('ACKNOWLEDGED', 'COMPLETED') or acknowledged_at is not null),
  check ((status = 'COMPLETED') = (completed_at is not null)),
  check ((status = 'VOIDED') = (voided_at is not null)),
  check ((voided_at is null) = (void_reason is null))
);

create index emergency_coordination_case_patient_idx
  on emergency_coordination_case (tenant_id, patient_id, encounter_id, status, due_at);

create function prevent_emergency_coordination_identity_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'emergency coordination identity is immutable once recorded';
end;
$$;

create trigger emergency_coordination_identity_immutable
  before update of patient_id, encounter_id, facility_id, case_type, requested_by
  on emergency_coordination_case
  for each row execute function prevent_emergency_coordination_identity_mutation();
