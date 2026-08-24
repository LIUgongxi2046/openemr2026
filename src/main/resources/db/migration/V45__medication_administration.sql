create table medication_administration (
  tenant_id uuid not null,
  administration_id uuid not null,
  execution_task_id uuid not null,
  order_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  drug_code varchar(128) not null,
  dose_value numeric(18,6) not null check (dose_value > 0),
  dose_unit varchar(64) not null,
  route_code varchar(64) not null,
  administered_at timestamptz not null,
  administered_by uuid not null,
  verified_by uuid not null,
  verification_note varchar(1000),
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  primary key (tenant_id, administration_id),
  unique (tenant_id, execution_task_id),
  foreign key (tenant_id, execution_task_id)
    references order_execution_task(tenant_id, execution_task_id),
  foreign key (tenant_id, order_id) references clinical_order(tenant_id, order_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, administered_by) references app_user(tenant_id, user_id),
  foreign key (tenant_id, verified_by) references app_user(tenant_id, user_id),
  check (administered_by <> verified_by)
);

create index medication_administration_encounter_idx
  on medication_administration (tenant_id, encounter_id, administered_at desc, administration_id desc);

create function prevent_medication_administration_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'medication administration records are immutable';
end $$;

create trigger medication_administration_immutable
  before update or delete on medication_administration
  for each row execute function prevent_medication_administration_mutation();
