create table dental_treatment_record (
  tenant_id uuid not null,
  dental_treatment_record_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  tooth_notation varchar(2) not null,
  treatment_type varchar(24) not null check (treatment_type in (
    'FILLING', 'EXTRACTION', 'ROOT_CANAL', 'CROWN', 'CLEANING', 'OTHER')),
  material_batch varchar(64),
  treated_at timestamptz not null,
  performed_by uuid not null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  primary key (tenant_id, dental_treatment_record_id),
  check (tooth_notation ~ '^[1-8][1-8]$'),
  check (
    (left(tooth_notation, 1) between '1' and '4' and right(tooth_notation, 1) between '1' and '8')
    or (left(tooth_notation, 1) between '5' and '8' and right(tooth_notation, 1) between '1' and '5')
  ),
  constraint dental_treatment_material_batch_check
    check (treatment_type not in ('FILLING', 'CROWN') or material_batch is not null),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, performed_by) references app_user(tenant_id, user_id)
);

create index dental_treatment_patient_idx
  on dental_treatment_record (tenant_id, patient_id, treated_at desc, dental_treatment_record_id desc);

create function prevent_dental_treatment_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'dental treatment record is immutable once recorded';
end $$;

create trigger dental_treatment_immutable
  before update of patient_id, encounter_id, tooth_notation, treatment_type, material_batch, treated_at
  on dental_treatment_record
  for each row execute function prevent_dental_treatment_mutation();
