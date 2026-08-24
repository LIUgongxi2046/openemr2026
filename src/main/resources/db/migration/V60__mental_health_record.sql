create table mental_health_record (
  tenant_id uuid not null,
  mental_health_record_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  data_classification varchar(16) not null default 'RESTRICTED' check (data_classification = 'RESTRICTED'),
  suicide_risk_level varchar(16) not null check (suicide_risk_level in ('NONE', 'LOW', 'MODERATE', 'HIGH', 'IMMINENT')),
  violence_risk_level varchar(16) not null check (violence_risk_level in ('NONE', 'LOW', 'MODERATE', 'HIGH')),
  risk_assessed_at timestamptz not null,
  protective_measures text,
  status varchar(16) not null check (status in ('ACTIVE', 'COMPLETED')),
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, mental_health_record_id),
  unique (tenant_id, encounter_id),
  check (not (suicide_risk_level in ('HIGH', 'IMMINENT') or violence_risk_level = 'HIGH')
         or (protective_measures is not null and length(trim(protective_measures)) >= 2)),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id)
);

create index mental_health_record_patient_idx
  on mental_health_record (tenant_id, patient_id, status, risk_assessed_at desc, mental_health_record_id desc);

create function prevent_mental_health_record_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'mental health record identity is immutable once created';
end $$;

create trigger mental_health_record_immutable
  before update of patient_id, encounter_id, data_classification, suicide_risk_level,
    violence_risk_level, risk_assessed_at, protective_measures on mental_health_record
  for each row execute function prevent_mental_health_record_mutation();
