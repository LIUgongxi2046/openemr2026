create table ent_record (
  tenant_id uuid not null,
  ent_record_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  laterality varchar(16) not null check (laterality in ('LEFT', 'RIGHT', 'BILATERAL')),
  region varchar(16) not null check (region in ('EAR', 'NOSE', 'THROAT')),
  airway_risk_level varchar(16) not null check (airway_risk_level in ('NONE', 'LOW', 'MODERATE', 'HIGH')),
  airway_precautions text,
  status varchar(16) not null check (status in ('ACTIVE', 'COMPLETED')),
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, ent_record_id),
  unique (tenant_id, encounter_id),
  check (airway_risk_level <> 'HIGH'
         or (airway_precautions is not null and length(trim(airway_precautions)) >= 2)),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id)
);

create index ent_record_patient_idx
  on ent_record (tenant_id, patient_id, status, created_at desc, ent_record_id desc);

create function prevent_ent_record_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'ENT record identity is immutable once created';
end $$;

create trigger ent_record_immutable
  before update of patient_id, encounter_id, laterality, region, airway_risk_level, airway_precautions
  on ent_record
  for each row execute function prevent_ent_record_mutation();
