create table dental_record (
  tenant_id uuid not null,
  dental_record_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  tooth_notation varchar(2) not null,
  procedure_tooth varchar(2),
  status varchar(16) not null check (status in ('ACTIVE', 'COMPLETED')),
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, dental_record_id),
  unique (tenant_id, encounter_id, tooth_notation),
  check (tooth_notation ~ '^[1-8][1-8]$'),
  check (procedure_tooth is null or procedure_tooth ~ '^[1-8][1-8]$'),
  check (
    (left(tooth_notation, 1) between '1' and '4' and right(tooth_notation, 1) between '1' and '8')
    or (left(tooth_notation, 1) between '5' and '8' and right(tooth_notation, 1) between '1' and '5')
  ),
  check (procedure_tooth is null or procedure_tooth = tooth_notation),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id)
);

create index dental_record_patient_idx
  on dental_record (tenant_id, patient_id, status, created_at desc, dental_record_id desc);

create function prevent_dental_record_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'dental record identity is immutable once created';
end $$;

create trigger dental_record_immutable
  before update of patient_id, encounter_id, tooth_notation, procedure_tooth
  on dental_record
  for each row execute function prevent_dental_record_mutation();
