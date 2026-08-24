create table emergency_observation (
  tenant_id uuid not null,
  observation_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  observation_started_at timestamptz not null,
  disposition varchar(16) not null default 'PENDING'
    check (disposition in ('PENDING', 'DISCHARGED', 'ADMITTED', 'TRANSFERRED')),
  status varchar(16) not null check (status in ('OBSERVING', 'COMPLETED')),
  completed_at timestamptz,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, observation_id),
  unique (tenant_id, encounter_id),
  check ((status = 'COMPLETED') = (completed_at is not null)),
  check ((status = 'COMPLETED') = (disposition <> 'PENDING')),
  check (completed_at is null or completed_at >= observation_started_at),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id)
);

create index emergency_observation_patient_idx
  on emergency_observation (tenant_id, patient_id, status, observation_started_at desc, observation_id desc);

create function prevent_emergency_observation_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'emergency observation identity is immutable once created';
end $$;

create trigger emergency_observation_immutable
  before update of patient_id, encounter_id, facility_id, observation_started_at on emergency_observation
  for each row execute function prevent_emergency_observation_mutation();
