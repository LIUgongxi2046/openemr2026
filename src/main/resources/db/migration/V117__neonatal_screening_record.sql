create table neonatal_screening_record (
  tenant_id uuid not null,
  screening_id uuid not null,
  patient_id uuid not null,
  mother_patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  screening_type varchar(24) not null check (screening_type in ('HEARING', 'METABOLIC', 'CONGENITAL_HEART')),
  screening_result varchar(16) not null check (screening_result in ('PASS', 'REFER', 'PENDING')),
  referred_to varchar(256),
  screened_at timestamptz not null,
  recorded_by uuid not null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  primary key (tenant_id, screening_id),
  constraint neonatal_screening_mother_check check (mother_patient_id <> patient_id),
  constraint neonatal_screening_refer_check
    check (screening_result <> 'REFER' or (referred_to is not null and length(trim(referred_to)) >= 2)),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, mother_patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, recorded_by) references app_user(tenant_id, user_id)
);

create index neonatal_screening_patient_idx
  on neonatal_screening_record (tenant_id, patient_id, screened_at desc, screening_id desc);

create function prevent_neonatal_screening_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'neonatal screening record is immutable once recorded';
end $$;

create trigger neonatal_screening_immutable
  before update of patient_id, mother_patient_id, screening_type, screening_result, referred_to, screened_at
  on neonatal_screening_record
  for each row execute function prevent_neonatal_screening_mutation();
