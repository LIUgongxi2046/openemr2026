create table obstetric_antenatal_exam (
  tenant_id uuid not null,
  exam_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  gestational_weeks integer not null,
  fundal_height_cm numeric(5,1),
  fetal_heart_rate integer,
  systolic_bp integer not null,
  diastolic_bp integer not null,
  proteinuria varchar(16) not null check (proteinuria in ('NEGATIVE', 'TRACE', 'POSITIVE')),
  preeclampsia_risk boolean not null default false,
  examined_at timestamptz not null,
  recorded_by uuid not null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  primary key (tenant_id, exam_id),
  constraint obstetric_antenatal_weeks_check check (gestational_weeks between 0 and 45),
  constraint obstetric_antenatal_fhr_check check (fetal_heart_rate is null or fetal_heart_rate between 60 and 200),
  constraint obstetric_antenatal_bp_check check (systolic_bp between 60 and 250 and diastolic_bp between 40 and 150),
  constraint obstetric_antenatal_preeclampsia_check
    check (not preeclampsia_risk or ((systolic_bp >= 140 or diastolic_bp >= 90) and proteinuria = 'POSITIVE')),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, recorded_by) references app_user(tenant_id, user_id)
);

create index obstetric_antenatal_patient_idx
  on obstetric_antenatal_exam (tenant_id, patient_id, examined_at desc, exam_id desc);

create function prevent_obstetric_antenatal_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'obstetric antenatal exam is immutable once recorded';
end $$;

create trigger obstetric_antenatal_immutable
  before update of patient_id, encounter_id, gestational_weeks, fundal_height_cm, fetal_heart_rate,
    systolic_bp, diastolic_bp, proteinuria, preeclampsia_risk, examined_at
  on obstetric_antenatal_exam
  for each row execute function prevent_obstetric_antenatal_mutation();
