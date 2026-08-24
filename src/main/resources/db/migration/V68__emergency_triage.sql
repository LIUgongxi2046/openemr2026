create table emergency_triage_assessment (
  tenant_id uuid not null,
  triage_assessment_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  triage_level varchar(8) not null check (triage_level in ('LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'LEVEL_4')),
  chief_complaint varchar(512) not null check (length(trim(chief_complaint)) >= 2),
  triaged_at timestamptz not null,
  immediate_action_required boolean not null default false,
  status varchar(16) not null check (status in ('ACTIVE', 'SUPERSEDED')),
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, triage_assessment_id),
  unique (tenant_id, encounter_id),
  check (triage_level <> 'LEVEL_1' or immediate_action_required),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id)
);

create index emergency_triage_patient_idx
  on emergency_triage_assessment (tenant_id, patient_id, status, triaged_at desc, triage_assessment_id desc);

create function prevent_emergency_triage_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'emergency triage identity is immutable once created';
end $$;

create trigger emergency_triage_immutable
  before update of patient_id, encounter_id, triage_level, chief_complaint,
    triaged_at, immediate_action_required on emergency_triage_assessment
  for each row execute function prevent_emergency_triage_mutation();
