create table emergency_preadmission (
  tenant_id uuid not null,
  preadmission_id uuid not null,
  facility_id uuid not null,
  temporary_identifier varchar(128) not null check (length(trim(temporary_identifier)) >= 2),
  reason varchar(1000) not null check (length(trim(reason)) >= 2),
  status varchar(16) not null check (status in ('UNREGISTERED', 'REGISTERED')),
  registered_patient_id uuid,
  registered_at timestamptz,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, preadmission_id),
  unique (tenant_id, temporary_identifier),
  check ((status = 'REGISTERED') = (registered_patient_id is not null)),
  check ((status = 'REGISTERED') = (registered_at is not null)),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, registered_patient_id) references patient(tenant_id, patient_id)
);

create index emergency_preadmission_facility_idx
  on emergency_preadmission (tenant_id, facility_id, status, created_at desc, preadmission_id desc);

create function prevent_emergency_preadmission_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'emergency preadmission identity is immutable once registered';
end $$;

create trigger emergency_preadmission_immutable
  before update of temporary_identifier, reason on emergency_preadmission
  for each row execute function prevent_emergency_preadmission_mutation();
