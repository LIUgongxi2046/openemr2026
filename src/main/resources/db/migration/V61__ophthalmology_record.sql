create table ophthalmology_record (
  tenant_id uuid not null,
  ophthalmology_record_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  laterality varchar(2) not null check (laterality in ('OD', 'OS', 'OU')),
  iop_od_mmhg numeric(5,1) check (iop_od_mmhg between 0 and 80),
  iop_os_mmhg numeric(5,1) check (iop_os_mmhg between 0 and 80),
  surgical_eye varchar(4) not null check (surgical_eye in ('NONE', 'OD', 'OS', 'OU')),
  status varchar(16) not null check (status in ('ACTIVE', 'COMPLETED')),
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, ophthalmology_record_id),
  unique (tenant_id, encounter_id),
  check (surgical_eye = 'NONE' or laterality = 'OU' or surgical_eye = laterality),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id)
);

create index ophthalmology_record_patient_idx
  on ophthalmology_record (tenant_id, patient_id, status, created_at desc, ophthalmology_record_id desc);

create function prevent_ophthalmology_record_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'ophthalmology record identity is immutable once created';
end $$;

create trigger ophthalmology_record_immutable
  before update of patient_id, encounter_id, laterality, iop_od_mmhg, iop_os_mmhg, surgical_eye
  on ophthalmology_record
  for each row execute function prevent_ophthalmology_record_mutation();
