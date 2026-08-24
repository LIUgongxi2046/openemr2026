create table dermatology_record (
  tenant_id uuid not null,
  dermatology_record_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  body_site varchar(24) not null check (body_site in ('SCALP', 'FACE', 'NECK', 'TRUNK', 'UPPER_EXTREMITY', 'LOWER_EXTREMITY', 'PALMOPLANTAR', 'GENITAL', 'MUCOSAL', 'OTHER')),
  bsa_percent numeric(5,1) not null check (bsa_percent between 0 and 100),
  pasi_score numeric(5,1) check (pasi_score between 0 and 72),
  status varchar(16) not null check (status in ('ACTIVE', 'COMPLETED')),
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, dermatology_record_id),
  unique (tenant_id, encounter_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id)
);

create index dermatology_record_patient_idx
  on dermatology_record (tenant_id, patient_id, status, created_at desc, dermatology_record_id desc);

create function prevent_dermatology_record_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'dermatology record identity is immutable once created';
end $$;

create trigger dermatology_record_immutable
  before update of patient_id, encounter_id, body_site, bsa_percent, pasi_score
  on dermatology_record
  for each row execute function prevent_dermatology_record_mutation();
