create table ent_airway_risk_handover (
  tenant_id uuid not null,
  handover_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  airway_risk_level varchar(16) not null check (airway_risk_level in ('MODERATE', 'HIGH')),
  airway_precautions varchar(2000) not null check (length(trim(airway_precautions)) >= 2),
  from_provider_id uuid not null,
  to_provider_id uuid not null,
  handed_over_at timestamptz not null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  primary key (tenant_id, handover_id),
  constraint ent_airway_provider_check check (from_provider_id <> to_provider_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, from_provider_id) references app_user(tenant_id, user_id),
  foreign key (tenant_id, to_provider_id) references app_user(tenant_id, user_id)
);

create index ent_airway_handover_patient_idx
  on ent_airway_risk_handover (tenant_id, patient_id, handed_over_at desc, handover_id desc);

create function prevent_ent_airway_handover_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'ENT airway risk handover is immutable once recorded';
end $$;

create trigger ent_airway_handover_immutable
  before update of patient_id, encounter_id, airway_risk_level, airway_precautions,
    from_provider_id, to_provider_id, handed_over_at
  on ent_airway_risk_handover
  for each row execute function prevent_ent_airway_handover_mutation();
