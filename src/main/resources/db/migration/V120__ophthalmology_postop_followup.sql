create table ophthalmology_postop_followup (
  tenant_id uuid not null,
  followup_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  surgical_eye varchar(2) not null check (surgical_eye in ('OD', 'OS', 'OU')),
  followup_date timestamptz not null,
  iop_mmhg numeric(5,1) not null,
  complication_note varchar(2000),
  recorded_by uuid not null,
  recorded_at timestamptz not null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  primary key (tenant_id, followup_id),
  constraint ophthalmology_postop_iop_check check (iop_mmhg between 0 and 80),
  constraint ophthalmology_postop_iop_complication_check
    check (iop_mmhg <= 21 or (complication_note is not null and length(trim(complication_note)) >= 2)),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, recorded_by) references app_user(tenant_id, user_id)
);

create index ophthalmology_postop_patient_idx
  on ophthalmology_postop_followup (tenant_id, patient_id, followup_date desc, followup_id desc);

create function prevent_ophthalmology_postop_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'ophthalmology postop followup is immutable once recorded';
end $$;

create trigger ophthalmology_postop_immutable
  before update of patient_id, encounter_id, surgical_eye, followup_date, iop_mmhg, complication_note
  on ophthalmology_postop_followup
  for each row execute function prevent_ophthalmology_postop_mutation();
