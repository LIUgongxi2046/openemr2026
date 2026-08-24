alter table medication_catalog_version
  add column prescribing_restriction_code varchar(64),
  add constraint medication_catalog_restriction_check check (
    prescribing_restriction_code is null
    or prescribing_restriction_code in ('RESTRICTED_ANTIBIOTIC', 'CONTROLLED_SUBSTANCE', 'SPECIAL_USE'));

create table medication_prescribing_authorization (
  tenant_id uuid not null,
  authorization_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  drug_code varchar(128) not null,
  restriction_code varchar(64) not null check (
    restriction_code in ('RESTRICTED_ANTIBIOTIC', 'CONTROLLED_SUBSTANCE', 'SPECIAL_USE')),
  approved_by uuid not null,
  approved_at timestamptz not null,
  valid_until timestamptz,
  status varchar(16) not null check (status in ('ACTIVE', 'REVOKED', 'EXPIRED')),
  reason varchar(1000),
  created_at timestamptz not null default now(),
  primary key (tenant_id, authorization_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, approved_by) references app_user(tenant_id, user_id)
);

create index medication_authorization_active_idx
  on medication_prescribing_authorization (tenant_id, patient_id, encounter_id, drug_code, status);

create function prevent_medication_authorization_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'medication prescribing authorization is immutable';
end $$;

create trigger medication_prescribing_authorization_immutable
  before update or delete on medication_prescribing_authorization
  for each row execute function prevent_medication_authorization_mutation();
