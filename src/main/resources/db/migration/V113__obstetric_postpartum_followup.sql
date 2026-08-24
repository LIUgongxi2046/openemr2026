create table obstetric_postpartum_followup (
  tenant_id uuid not null,
  followup_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  followup_date timestamptz not null,
  lochia_status varchar(16) not null check (lochia_status in ('NORMAL', 'ABNORMAL')),
  wound_healing varchar(16) not null check (wound_healing in ('GOOD', 'COMPLICATED')),
  complications varchar(2000),
  recorded_by uuid not null,
  recorded_at timestamptz not null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  primary key (tenant_id, followup_id),
  constraint obstetric_postpartum_complication_check
    check ((lochia_status = 'NORMAL' and wound_healing = 'GOOD')
           or (complications is not null and length(trim(complications)) >= 2)),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, recorded_by) references app_user(tenant_id, user_id)
);

create index obstetric_postpartum_patient_idx
  on obstetric_postpartum_followup (tenant_id, patient_id, followup_date desc, followup_id desc);

create function prevent_obstetric_postpartum_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'obstetric postpartum followup is immutable once recorded';
end $$;

create trigger obstetric_postpartum_immutable
  before update of patient_id, encounter_id, followup_date, lochia_status, wound_healing, complications
  on obstetric_postpartum_followup
  for each row execute function prevent_obstetric_postpartum_mutation();
