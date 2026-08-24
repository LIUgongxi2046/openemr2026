create table infection_monitoring_event (
  tenant_id uuid not null,
  infection_event_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  infection_type varchar(32) not null
    check (infection_type in ('SURGICAL_SITE', 'URINARY_TRACT', 'BLOODSTREAM', 'PNEUMONIA', 'OTHER')),
  organism_code varchar(128),
  reported_at timestamptz not null,
  status varchar(16) not null check (status in ('REPORTED', 'CONFIRMED', 'REFUTED')),
  conclusion varchar(1000),
  resolved_at timestamptz,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, infection_event_id),
  check ((status in ('CONFIRMED', 'REFUTED')) = (resolved_at is not null)),
  check ((status in ('CONFIRMED', 'REFUTED')) = (conclusion is not null and length(trim(conclusion)) >= 2)),
  check (resolved_at is null or resolved_at >= reported_at),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id)
);

create index infection_event_patient_idx
  on infection_monitoring_event (tenant_id, patient_id, status, reported_at desc, infection_event_id desc);

create function prevent_infection_event_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'infection monitoring event identity is immutable once created';
end $$;

create trigger infection_event_immutable
  before update of patient_id, encounter_id, facility_id, infection_type, organism_code, reported_at
  on infection_monitoring_event
  for each row execute function prevent_infection_event_mutation();
