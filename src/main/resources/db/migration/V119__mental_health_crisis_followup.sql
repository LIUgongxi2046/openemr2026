create table mental_health_crisis_followup (
  tenant_id uuid not null,
  followup_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  followup_date timestamptz not null,
  risk_level varchar(16) not null check (risk_level in ('NONE', 'LOW', 'MODERATE', 'HIGH', 'IMMINENT')),
  protective_measures varchar(2000),
  data_classification varchar(16) not null default 'RESTRICTED' check (data_classification = 'RESTRICTED'),
  recorded_by uuid not null,
  recorded_at timestamptz not null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  primary key (tenant_id, followup_id),
  constraint mental_health_crisis_followup_protection_check
    check (risk_level not in ('HIGH', 'IMMINENT')
           or (protective_measures is not null and length(trim(protective_measures)) >= 2)),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, recorded_by) references app_user(tenant_id, user_id)
);

create index mental_health_crisis_followup_patient_idx
  on mental_health_crisis_followup (tenant_id, patient_id, followup_date desc, followup_id desc);

create function prevent_mental_health_crisis_followup_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'mental health crisis followup is immutable once recorded';
end $$;

create trigger mental_health_crisis_followup_immutable
  before update of patient_id, encounter_id, followup_date, risk_level, protective_measures, data_classification
  on mental_health_crisis_followup
  for each row execute function prevent_mental_health_crisis_followup_mutation();
