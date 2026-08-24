create table emergency_resuscitation (
  tenant_id uuid not null,
  resuscitation_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  outcome varchar(16) not null default 'PENDING'
    check (outcome in ('PENDING', 'ROSC', 'DEATH', 'TRANSFERRED')),
  status varchar(16) not null check (status in ('IN_PROGRESS', 'COMPLETED')),
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, resuscitation_id),
  unique (tenant_id, encounter_id),
  check ((status = 'COMPLETED') = (ended_at is not null)),
  check ((status = 'COMPLETED') = (outcome <> 'PENDING')),
  check (ended_at is null or ended_at >= started_at),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id)
);

create index emergency_resuscitation_patient_idx
  on emergency_resuscitation (tenant_id, patient_id, status, started_at desc, resuscitation_id desc);

create function prevent_emergency_resuscitation_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'emergency resuscitation identity is immutable once created';
end $$;

create trigger emergency_resuscitation_immutable
  before update of patient_id, encounter_id, facility_id, started_at on emergency_resuscitation
  for each row execute function prevent_emergency_resuscitation_mutation();
