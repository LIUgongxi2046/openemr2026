create table tcm_herbal_prescription (
  tenant_id uuid not null,
  prescription_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  formula_name varchar(256) not null check (length(trim(formula_name)) >= 2),
  herbs varchar(2000) not null check (length(trim(herbs)) >= 2),
  contains_toxic_herb boolean not null default false,
  toxic_herb_precautions varchar(2000),
  prescribed_at timestamptz not null,
  prescribed_by uuid not null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  primary key (tenant_id, prescription_id),
  constraint tcm_prescription_toxic_check
    check (not contains_toxic_herb
           or (toxic_herb_precautions is not null and length(trim(toxic_herb_precautions)) >= 2)),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, prescribed_by) references app_user(tenant_id, user_id)
);

create index tcm_prescription_patient_idx
  on tcm_herbal_prescription (tenant_id, patient_id, prescribed_at desc, prescription_id desc);

create function prevent_tcm_prescription_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'TCM herbal prescription is immutable once recorded';
end $$;

create trigger tcm_prescription_immutable
  before update of patient_id, encounter_id, formula_name, herbs, contains_toxic_herb,
    toxic_herb_precautions, prescribed_at
  on tcm_herbal_prescription
  for each row execute function prevent_tcm_prescription_mutation();
