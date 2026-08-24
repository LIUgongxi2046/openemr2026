create table blood_transfusion (
  tenant_id uuid not null,
  transfusion_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  blood_product varchar(32) not null check (blood_product in ('RED_CELLS', 'PLATELETS', 'PLASMA', 'CRYO', 'WHOLE_BLOOD')),
  blood_type varchar(8) not null check (blood_type in ('A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG')),
  unit_number varchar(64) not null check (length(trim(unit_number)) >= 2),
  volume_ml integer not null check (volume_ml > 0),
  started_at timestamptz not null,
  administered_by uuid not null,
  verified_by uuid not null,
  verification_note varchar(1000),
  reaction_type varchar(32) check (reaction_type in ('FEBRILE', 'ALLERGIC', 'HEMOLYTIC', 'TRALI', 'TACO', 'NONE')),
  reaction_noted_at timestamptz,
  reaction_noted_by uuid,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, transfusion_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, administered_by) references app_user(tenant_id, user_id),
  foreign key (tenant_id, verified_by) references app_user(tenant_id, user_id),
  foreign key (tenant_id, reaction_noted_by) references app_user(tenant_id, user_id),
  check (administered_by <> verified_by)
);

create index blood_transfusion_encounter_idx
  on blood_transfusion (tenant_id, encounter_id, started_at desc, transfusion_id desc);

create function prevent_blood_transfusion_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'blood transfusion record is immutable once administered';
end $$;

create trigger blood_transfusion_immutable
  before update of patient_id, encounter_id, blood_product, blood_type, unit_number, volume_ml,
    started_at, administered_by, verified_by on blood_transfusion
  for each row execute function prevent_blood_transfusion_mutation();
