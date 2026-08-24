create table context_lease (
  tenant_id uuid not null,
  lease_id uuid not null,
  organization_id uuid not null,
  facility_id uuid not null,
  user_id uuid not null,
  role_assignment_ids uuid[] not null,
  patient_id uuid,
  encounter_id uuid,
  task_id uuid,
  purpose_code varchar(96) not null,
  allowed_source_types text[] not null,
  allowed_time_start timestamptz,
  allowed_time_end timestamptz,
  authorization_watermark char(64) not null,
  data_classification_ceiling varchar(24) not null,
  model_residency_policy varchar(32) not null,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revocation_reason varchar(256),
  row_version bigint not null default 1 check (row_version > 0),
  primary key (tenant_id, lease_id),
  unique (tenant_id, authorization_watermark),
  foreign key (tenant_id, organization_id) references organization(tenant_id, organization_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, user_id) references app_user(tenant_id, user_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  check (cardinality(role_assignment_ids) > 0),
  check (cardinality(allowed_source_types) > 0),
  check (btrim(purpose_code) <> ''),
  check (expires_at > issued_at),
  check (allowed_time_end is null or allowed_time_start is null or allowed_time_end >= allowed_time_start),
  check (encounter_id is null or patient_id is not null),
  check (data_classification_ceiling in ('PUBLIC', 'INTERNAL', 'SENSITIVE', 'RESTRICTED')),
  check (model_residency_policy in ('ON_PREM_ONLY', 'CN_REGION_ONLY', 'APPROVED_EXTERNAL')),
  check ((revoked_at is null) = (revocation_reason is null))
);

create index context_lease_active_expiry_idx
  on context_lease (tenant_id, user_id, expires_at)
  where revoked_at is null;

create index context_lease_patient_idx
  on context_lease (tenant_id, patient_id, expires_at desc)
  where patient_id is not null;
