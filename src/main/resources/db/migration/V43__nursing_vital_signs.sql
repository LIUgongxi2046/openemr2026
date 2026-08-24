create table vital_sign_record (
  tenant_id uuid not null,
  vital_sign_record_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  admission_id uuid,
  recorded_at timestamptz not null,
  recorded_by uuid not null,
  source varchar(16) not null check (source in ('MANUAL', 'DEVICE')),
  temperature numeric(5,2),
  pulse integer,
  respiration integer,
  systolic_bp integer,
  diastolic_bp integer,
  spo2 numeric(5,2),
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, vital_sign_record_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, admission_id) references inpatient_admission(tenant_id, admission_id),
  foreign key (tenant_id, recorded_by) references app_user(tenant_id, user_id),
  check (temperature is null or temperature between 30 and 45),
  check (pulse is null or pulse between 20 and 300),
  check (respiration is null or respiration between 4 and 60),
  check (systolic_bp is null or systolic_bp between 40 and 300),
  check (diastolic_bp is null or diastolic_bp between 20 and 200),
  check (spo2 is null or spo2 between 50 and 100),
  check (diastolic_bp is null or systolic_bp is null or diastolic_bp < systolic_bp)
);

create index vital_sign_record_encounter_idx
  on vital_sign_record (tenant_id, encounter_id, recorded_at desc, vital_sign_record_id desc);

create function prevent_vital_sign_record_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'vital sign records are immutable';
end $$;

create trigger vital_sign_record_immutable
  before update or delete on vital_sign_record
  for each row execute function prevent_vital_sign_record_mutation();
