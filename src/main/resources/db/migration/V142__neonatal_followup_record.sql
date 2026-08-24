create table neonatal_followup_record (
  tenant_id uuid not null,
  followup_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  followup_reason varchar(1000) not null check (length(trim(followup_reason)) >= 2),
  scheduled_date timestamptz not null,
  attended boolean not null default true,
  no_show_reason varchar(1000),
  outcome_note varchar(2000),
  recorded_by uuid not null,
  recorded_at timestamptz not null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  primary key (tenant_id, followup_id),
  constraint neonatal_followup_no_show_check
    check (attended or (no_show_reason is not null and length(trim(no_show_reason)) >= 2)),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, recorded_by) references app_user(tenant_id, user_id)
);

create index neonatal_followup_patient_idx
  on neonatal_followup_record (tenant_id, patient_id, scheduled_date desc, followup_id desc);

create function prevent_neonatal_followup_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'neonatal followup record is immutable once recorded';
end $$;

create trigger neonatal_followup_immutable
  before update of patient_id, encounter_id, followup_reason, scheduled_date, attended, no_show_reason, outcome_note
  on neonatal_followup_record
  for each row execute function prevent_neonatal_followup_mutation();
