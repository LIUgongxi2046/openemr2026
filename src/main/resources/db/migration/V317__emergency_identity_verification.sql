create table emergency_identity_verification (
  tenant_id uuid not null,
  verification_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  identifier_type varchar(64),
  masked_identifier varchar(128) not null,
  verification_purpose varchar(64) not null,
  outcome varchar(24) not null check (outcome in ('MATCHED', 'MISMATCHED', 'NOT_FOUND')),
  verified_by uuid not null,
  verified_at timestamptz not null,
  row_version bigint not null default 1 check (row_version > 0),
  primary key (tenant_id, verification_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, verified_by) references app_user(tenant_id, user_id),
  check (length(trim(masked_identifier)) >= 2),
  check (length(trim(verification_purpose)) >= 3)
);

create index emergency_identity_verification_patient_idx
  on emergency_identity_verification (tenant_id, patient_id, encounter_id, verified_at desc, verification_id desc);

create function prevent_emergency_identity_verification_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'emergency identity verification is immutable once recorded';
end;
$$;

create trigger emergency_identity_verification_immutable
  before update or delete on emergency_identity_verification
  for each row execute function prevent_emergency_identity_verification_mutation();
