create table clinical_department (
  tenant_id uuid not null,
  facility_id uuid not null,
  department_id uuid not null,
  department_code varchar(96) not null,
  display_name varchar(256) not null,
  status varchar(24) not null check (status in ('ACTIVE', 'INACTIVE')),
  primary key (tenant_id, facility_id, department_id),
  unique (tenant_id, facility_id, department_code),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id)
);

create table specialty_pack_release (
  tenant_id uuid not null,
  specialty_pack_release_id uuid not null,
  pack_code varchar(96) not null,
  semantic_version varchar(32) not null,
  content_hash char(64) not null,
  manifest jsonb not null,
  lifecycle_status varchar(24) not null
    check (lifecycle_status in ('DRAFT','VALIDATED','APPROVED','CANARY','ACTIVE','RETIRED','ROLLED_BACK')),
  compatibility_range jsonb not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, specialty_pack_release_id),
  unique (tenant_id, pack_code, semantic_version),
  foreign key (tenant_id) references tenant(tenant_id),
  foreign key (tenant_id, created_by) references app_user(tenant_id, user_id),
  check (content_hash ~ '^[0-9a-f]{64}$')
);

create table department_support_assessment (
  tenant_id uuid not null,
  department_support_assessment_id uuid not null,
  facility_id uuid not null,
  department_id uuid not null,
  clinical_scope_code varchar(96) not null,
  support_level varchar(32) not null
    check (support_level in ('GENERAL_AVAILABLE','BASIC_CLOSED_LOOP','PACK_PENDING','UNSUPPORTED')),
  pack_release_id uuid,
  evidence_bundle_hash char(64),
  missing_safety_gates text[] not null default '{}',
  assessed_by uuid not null,
  assessed_at timestamptz not null default now(),
  expires_at timestamptz,
  row_version bigint not null default 1 check (row_version > 0),
  primary key (tenant_id, department_support_assessment_id),
  unique (tenant_id, facility_id, department_id, clinical_scope_code),
  foreign key (tenant_id, facility_id, department_id)
    references clinical_department(tenant_id, facility_id, department_id),
  foreign key (tenant_id, pack_release_id)
    references specialty_pack_release(tenant_id, specialty_pack_release_id),
  foreign key (tenant_id, assessed_by) references app_user(tenant_id, user_id),
  check (evidence_bundle_hash is null or evidence_bundle_hash ~ '^[0-9a-f]{64}$'),
  check (expires_at is null or expires_at > assessed_at),
  check (support_level in ('PACK_PENDING','UNSUPPORTED') or evidence_bundle_hash is not null),
  check (support_level in ('PACK_PENDING','UNSUPPORTED') or cardinality(missing_safety_gates) = 0)
);

create index department_support_facility_idx
  on department_support_assessment (tenant_id, facility_id, support_level, clinical_scope_code);
