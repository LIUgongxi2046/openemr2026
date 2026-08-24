create table tcm_record (
  tenant_id uuid not null,
  tcm_record_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  syndrome_pattern varchar(256) not null check (length(trim(syndrome_pattern)) >= 2),
  treatment_principle varchar(256) not null check (length(trim(treatment_principle)) >= 2),
  formula_name varchar(256) not null check (length(trim(formula_name)) >= 2),
  contains_toxic_herb boolean not null default false,
  toxic_herb_precautions text,
  status varchar(16) not null check (status in ('ACTIVE', 'COMPLETED')),
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, tcm_record_id),
  unique (tenant_id, encounter_id),
  check (not contains_toxic_herb
         or (toxic_herb_precautions is not null and length(trim(toxic_herb_precautions)) >= 2)),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id)
);

create index tcm_record_patient_idx
  on tcm_record (tenant_id, patient_id, status, created_at desc, tcm_record_id desc);

create function prevent_tcm_record_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'TCM record identity is immutable once created';
end $$;

create trigger tcm_record_immutable
  before update of patient_id, encounter_id, syndrome_pattern, treatment_principle,
    formula_name, contains_toxic_herb, toxic_herb_precautions
  on tcm_record
  for each row execute function prevent_tcm_record_mutation();
