create table art_pregnancy_outcome (
  tenant_id uuid not null,
  outcome_id uuid not null,
  patient_id uuid not null,
  cycle_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  pregnancy_result varchar(24) not null check (pregnancy_result in ('PREGNANT', 'NOT_PREGNANT', 'BIOCHEMICAL', 'MISCARRIAGE')),
  outcome_date timestamptz not null,
  live_birth_count integer not null,
  complications varchar(2000),
  recorded_by uuid not null,
  recorded_at timestamptz not null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  primary key (tenant_id, outcome_id),
  constraint art_outcome_live_birth_check check (live_birth_count >= 0),
  constraint art_outcome_miscarriage_check
    check (pregnancy_result <> 'MISCARRIAGE'
           or (complications is not null and length(trim(complications)) >= 2)),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, cycle_id) references art_cycle_record(tenant_id, cycle_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, recorded_by) references app_user(tenant_id, user_id)
);

create index art_outcome_patient_idx
  on art_pregnancy_outcome (tenant_id, patient_id, outcome_date desc, outcome_id desc);

create function prevent_art_outcome_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'ART pregnancy outcome is immutable once recorded';
end $$;

create trigger art_outcome_immutable
  before update of patient_id, cycle_id, pregnancy_result, outcome_date, live_birth_count, complications
  on art_pregnancy_outcome
  for each row execute function prevent_art_outcome_mutation();
