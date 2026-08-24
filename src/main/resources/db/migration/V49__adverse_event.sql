create table adverse_event (
  tenant_id uuid not null,
  adverse_event_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  event_type varchar(32) not null check (event_type in (
    'MEDICATION_ERROR', 'FALL', 'PRESSURE_INJURY', 'TRANSFUSION_REACTION',
    'SURGICAL_COMPLICATION', 'INFECTION', 'OTHER')),
  severity varchar(16) not null check (severity in ('NEAR_MISS', 'MILD', 'MODERATE', 'SEVERE', 'SENTINEL')),
  description varchar(4000) not null check (length(trim(description)) >= 4),
  status varchar(16) not null check (status in ('REPORTED', 'REVIEWED', 'CLOSED')),
  reported_at timestamptz not null,
  reported_by uuid not null,
  reviewed_at timestamptz,
  reviewed_by uuid,
  review_conclusion varchar(2000),
  closed_at timestamptz,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, adverse_event_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, reported_by) references app_user(tenant_id, user_id),
  foreign key (tenant_id, reviewed_by) references app_user(tenant_id, user_id),
  check ((status = 'CLOSED') = (closed_at is not null))
);

create index adverse_event_encounter_idx
  on adverse_event (tenant_id, encounter_id, status, reported_at desc, adverse_event_id desc);

create function prevent_adverse_event_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'adverse event report is immutable once reported';
end $$;

create trigger adverse_event_immutable
  before update of event_type, severity, description, patient_id, encounter_id, reported_at, reported_by on adverse_event
  for each row execute function prevent_adverse_event_mutation();
