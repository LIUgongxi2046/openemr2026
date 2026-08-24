create table pediatric_record (
  tenant_id uuid not null,
  pediatric_record_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  guardian_name varchar(256) not null check (length(trim(guardian_name)) >= 2),
  guardian_relationship varchar(32) not null check (guardian_relationship in ('MOTHER', 'FATHER', 'LEGAL_GUARDIAN', 'OTHER')),
  guardian_phone varchar(64),
  age_in_months integer not null check (age_in_months between 0 and 216),
  weight_kg numeric(5,2) not null check (weight_kg between 0.5 and 250),
  measured_at timestamptz not null,
  critical_flag boolean not null default false,
  status varchar(16) not null check (status in ('ACTIVE', 'COMPLETED')),
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, pediatric_record_id),
  unique (tenant_id, encounter_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id)
);

create index pediatric_record_patient_idx
  on pediatric_record (tenant_id, patient_id, status, measured_at desc, pediatric_record_id desc);

create function prevent_pediatric_record_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'pediatric record identity is immutable once created';
end $$;

create trigger pediatric_record_immutable
  before update of patient_id, encounter_id, guardian_name, guardian_relationship,
    age_in_months, weight_kg, measured_at on pediatric_record
  for each row execute function prevent_pediatric_record_mutation();
