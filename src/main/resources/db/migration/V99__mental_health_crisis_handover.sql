create table mental_health_crisis_handover (
  tenant_id uuid not null,
  crisis_handover_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  from_provider_id uuid not null,
  to_provider_id uuid not null,
  crisis_reason varchar(1000) not null check (length(trim(crisis_reason)) >= 2),
  risk_level varchar(16) not null check (risk_level in ('LOW', 'MODERATE', 'HIGH', 'IMMINENT')),
  protective_measures varchar(2000),
  data_classification varchar(16) not null default 'RESTRICTED' check (data_classification = 'RESTRICTED'),
  handed_over_at timestamptz not null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  primary key (tenant_id, crisis_handover_id),
  constraint mental_health_crisis_provider_check check (from_provider_id <> to_provider_id),
  constraint mental_health_crisis_protection_check
    check (risk_level not in ('HIGH', 'IMMINENT')
           or (protective_measures is not null and length(trim(protective_measures)) >= 2)),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, from_provider_id) references app_user(tenant_id, user_id),
  foreign key (tenant_id, to_provider_id) references app_user(tenant_id, user_id)
);

create index mental_health_crisis_patient_idx
  on mental_health_crisis_handover (tenant_id, patient_id, handed_over_at desc, crisis_handover_id desc);

create function prevent_mental_health_crisis_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'mental health crisis handover identity is immutable once recorded';
end $$;

create trigger mental_health_crisis_immutable
  before update of patient_id, encounter_id, from_provider_id, to_provider_id, crisis_reason,
    risk_level, protective_measures, data_classification, handed_over_at
  on mental_health_crisis_handover
  for each row execute function prevent_mental_health_crisis_mutation();
