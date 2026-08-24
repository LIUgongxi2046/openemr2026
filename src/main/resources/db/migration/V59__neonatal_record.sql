create table neonatal_record (
  tenant_id uuid not null,
  neonatal_record_id uuid not null,
  patient_id uuid not null,
  mother_patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  birth_datetime timestamptz not null,
  gestational_age_weeks integer not null check (gestational_age_weeks between 22 and 45),
  apgar_1min integer not null check (apgar_1min between 0 and 10),
  apgar_5min integer not null check (apgar_5min between 0 and 10),
  birth_weight_g integer not null check (birth_weight_g between 200 and 7000),
  sex_at_birth varchar(16) not null check (sex_at_birth in ('MALE', 'FEMALE', 'INDETERMINATE')),
  status varchar(16) not null check (status in ('ACTIVE', 'COMPLETED')),
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, neonatal_record_id),
  unique (tenant_id, encounter_id),
  check (mother_patient_id <> patient_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, mother_patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id)
);

create index neonatal_record_patient_idx
  on neonatal_record (tenant_id, patient_id, status, birth_datetime desc, neonatal_record_id desc);

create index neonatal_record_mother_idx
  on neonatal_record (tenant_id, mother_patient_id, birth_datetime desc);

create function prevent_neonatal_record_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'neonatal record identity is immutable once created';
end $$;

create trigger neonatal_record_immutable
  before update of patient_id, mother_patient_id, birth_datetime, gestational_age_weeks,
    apgar_1min, apgar_5min, birth_weight_g, sex_at_birth on neonatal_record
  for each row execute function prevent_neonatal_record_mutation();
