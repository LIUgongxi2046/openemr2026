create table encounter_domain_switch (
  tenant_id uuid not null,
  domain_switch_id uuid not null,
  patient_id uuid not null,
  from_encounter_id uuid not null,
  to_encounter_id uuid not null,
  from_domain varchar(16) not null check (from_domain in ('OUTPATIENT', 'EMERGENCY')),
  to_domain varchar(16) not null check (to_domain in ('OUTPATIENT', 'EMERGENCY')),
  reason varchar(1000) not null check (length(trim(reason)) >= 2),
  switched_at timestamptz not null,
  switched_by uuid not null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  primary key (tenant_id, domain_switch_id),
  constraint encounter_domain_switch_domain_check check (from_domain <> to_domain),
  constraint encounter_domain_switch_encounter_check check (from_encounter_id <> to_encounter_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, from_encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, to_encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, switched_by) references app_user(tenant_id, user_id)
);

create index encounter_domain_switch_patient_idx
  on encounter_domain_switch (tenant_id, patient_id, switched_at desc, domain_switch_id desc);

create function prevent_encounter_domain_switch_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'encounter domain switch identity is immutable once recorded';
end $$;

create trigger encounter_domain_switch_immutable
  before update of patient_id, from_encounter_id, to_encounter_id, from_domain, to_domain, reason
  on encounter_domain_switch
  for each row execute function prevent_encounter_domain_switch_mutation();
