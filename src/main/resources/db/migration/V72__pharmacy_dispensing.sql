create table pharmacy_dispensing (
  tenant_id uuid not null,
  dispensing_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  drug_code varchar(128) not null check (length(trim(drug_code)) >= 2),
  batch_number varchar(128) not null check (length(trim(batch_number)) >= 2),
  quantity numeric(12,3) not null check (quantity > 0),
  quantity_unit varchar(32) not null check (length(trim(quantity_unit)) >= 1),
  dispensed_by uuid not null,
  verified_by uuid,
  status varchar(16) not null check (status in ('PREPARED', 'VERIFIED', 'DISPENSED')),
  prepared_at timestamptz not null,
  verified_at timestamptz,
  dispensed_at timestamptz,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, dispensing_id),
  check (verified_by is null or verified_by <> dispensed_by),
  check ((status in ('VERIFIED', 'DISPENSED')) = (verified_at is not null)),
  check ((status = 'DISPENSED') = (dispensed_at is not null)),
  check (verified_at is null or verified_at >= prepared_at),
  check (dispensed_at is null or dispensed_at >= verified_at),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, dispensed_by) references app_user(tenant_id, user_id),
  foreign key (tenant_id, verified_by) references app_user(tenant_id, user_id)
);

create index pharmacy_dispensing_patient_idx
  on pharmacy_dispensing (tenant_id, patient_id, status, prepared_at desc, dispensing_id desc);

create function prevent_pharmacy_dispensing_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'pharmacy dispensing identity is immutable once created';
end $$;

create trigger pharmacy_dispensing_immutable
  before update of patient_id, encounter_id, facility_id, drug_code, batch_number,
    quantity, quantity_unit, dispensed_by, prepared_at on pharmacy_dispensing
  for each row execute function prevent_pharmacy_dispensing_mutation();
