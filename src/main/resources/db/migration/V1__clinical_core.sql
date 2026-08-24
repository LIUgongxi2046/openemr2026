create table tenant (
  tenant_id uuid primary key,
  tenant_code varchar(64) not null unique,
  display_name varchar(256) not null,
  status varchar(24) not null check (status in ('ACTIVE', 'SUSPENDED')),
  created_at timestamptz not null default now()
);

create table organization (
  tenant_id uuid not null,
  organization_id uuid not null,
  organization_code varchar(64) not null,
  display_name varchar(256) not null,
  status varchar(24) not null check (status in ('ACTIVE', 'INACTIVE')),
  primary key (tenant_id, organization_id),
  unique (tenant_id, organization_code),
  foreign key (tenant_id) references tenant(tenant_id)
);

create table facility (
  tenant_id uuid not null,
  organization_id uuid not null,
  facility_id uuid not null,
  facility_code varchar(64) not null,
  display_name varchar(256) not null,
  timezone varchar(64) not null default 'Asia/Shanghai',
  status varchar(24) not null check (status in ('ACTIVE', 'INACTIVE')),
  primary key (tenant_id, facility_id),
  unique (tenant_id, organization_id, facility_code),
  foreign key (tenant_id, organization_id) references organization(tenant_id, organization_id)
);

create table app_user (
  tenant_id uuid not null,
  user_id uuid not null,
  external_subject varchar(256) not null,
  display_name varchar(256) not null,
  status varchar(24) not null check (status in ('ACTIVE', 'LOCKED', 'DISABLED')),
  primary key (tenant_id, user_id),
  unique (tenant_id, external_subject),
  foreign key (tenant_id) references tenant(tenant_id)
);

create table role_assignment (
  tenant_id uuid not null,
  role_assignment_id uuid not null,
  user_id uuid not null,
  organization_id uuid not null,
  facility_id uuid,
  role_code varchar(96) not null,
  valid_from timestamptz not null,
  valid_until timestamptz,
  status varchar(24) not null check (status in ('ACTIVE', 'SUSPENDED', 'EXPIRED')),
  row_version bigint not null default 1 check (row_version > 0),
  primary key (tenant_id, role_assignment_id),
  foreign key (tenant_id, user_id) references app_user(tenant_id, user_id),
  foreign key (tenant_id, organization_id) references organization(tenant_id, organization_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  check (valid_until is null or valid_until > valid_from)
);

create table patient (
  tenant_id uuid not null,
  patient_id uuid not null,
  display_name varchar(256) not null,
  sex_code varchar(32) not null,
  birth_date date not null,
  status varchar(24) not null check (status in ('ACTIVE', 'MERGED', 'DECEASED', 'VOID')),
  merged_into_patient_id uuid,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, patient_id),
  foreign key (tenant_id) references tenant(tenant_id),
  foreign key (tenant_id, merged_into_patient_id) references patient(tenant_id, patient_id),
  check ((status = 'MERGED') = (merged_into_patient_id is not null))
);

create table patient_identifier (
  tenant_id uuid not null,
  patient_identifier_id uuid not null,
  patient_id uuid not null,
  assigning_authority varchar(128) not null,
  identifier_type varchar(64) not null,
  identifier_hash bytea not null,
  masked_value varchar(128) not null,
  source_system varchar(128) not null,
  active boolean not null default true,
  primary key (tenant_id, patient_identifier_id),
  unique (tenant_id, assigning_authority, identifier_type, identifier_hash),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id)
);

create table encounter (
  tenant_id uuid not null,
  encounter_id uuid not null,
  patient_id uuid not null,
  organization_id uuid not null,
  facility_id uuid not null,
  encounter_type varchar(24) not null check (encounter_type in ('OUTPATIENT', 'EMERGENCY', 'INPATIENT')),
  status varchar(24) not null check (status in ('PLANNED', 'IN_PROGRESS', 'FINISHED', 'CANCELLED')),
  started_at timestamptz not null,
  ended_at timestamptz,
  source_system varchar(128),
  source_key varchar(256),
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, encounter_id),
  unique (tenant_id, source_system, source_key),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, organization_id) references organization(tenant_id, organization_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  check (ended_at is null or ended_at >= started_at)
);

create table clinical_document (
  tenant_id uuid not null,
  document_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  document_type_code varchar(96) not null,
  status varchar(24) not null check (status in ('DRAFT', 'READY_TO_SIGN', 'SIGNED', 'CORRECTED', 'VOID')),
  current_version_id uuid,
  row_version bigint not null default 1 check (row_version > 0),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, document_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, created_by) references app_user(tenant_id, user_id)
);

create table clinical_document_version (
  tenant_id uuid not null,
  document_id uuid not null,
  document_version_id uuid not null,
  version_no integer not null check (version_no > 0),
  status varchar(24) not null check (status in ('DRAFT', 'READY_TO_SIGN', 'SIGNED', 'CORRECTED', 'VOID')),
  sections jsonb not null,
  content_hash char(64) not null,
  based_on_version_id uuid,
  author_user_id uuid not null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  signed_at timestamptz,
  primary key (tenant_id, document_id, document_version_id),
  unique (tenant_id, document_version_id),
  unique (tenant_id, document_id, version_no),
  foreign key (tenant_id, document_id) references clinical_document(tenant_id, document_id),
  foreign key (tenant_id, document_id, based_on_version_id) references clinical_document_version(tenant_id, document_id, document_version_id),
  foreign key (tenant_id, author_user_id) references app_user(tenant_id, user_id),
  check ((status = 'SIGNED') = (signed_at is not null))
);

alter table clinical_document
  add constraint clinical_document_current_version_fk
  foreign key (tenant_id, document_id, current_version_id)
  references clinical_document_version(tenant_id, document_id, document_version_id)
  deferrable initially deferred;

create table signature_evidence (
  tenant_id uuid not null,
  signature_id uuid not null,
  document_id uuid not null,
  document_version_id uuid not null,
  signer_user_id uuid not null,
  signature_role varchar(64) not null,
  signature_status varchar(32) not null check (signature_status in ('VALID', 'PENDING_CA_EVIDENCE', 'REVOKED')),
  content_hash char(64) not null,
  credential_ref varchar(256),
  signed_at timestamptz not null,
  primary key (tenant_id, signature_id),
  unique (tenant_id, document_version_id, signer_user_id, signature_role),
  foreign key (tenant_id, document_id, document_version_id) references clinical_document_version(tenant_id, document_id, document_version_id),
  foreign key (tenant_id, signer_user_id) references app_user(tenant_id, user_id)
);

create table quality_finding (
  tenant_id uuid not null,
  finding_id uuid not null,
  document_id uuid not null,
  document_version_id uuid not null,
  rule_code varchar(128) not null,
  rule_version varchar(64) not null,
  severity varchar(24) not null check (severity in ('INFO', 'WARNING', 'BLOCKING')),
  message text not null,
  field_path varchar(512),
  state varchar(24) not null check (state in ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'WAIVED')),
  resolution_reason text,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, finding_id),
  foreign key (tenant_id, document_id, document_version_id) references clinical_document_version(tenant_id, document_id, document_version_id),
  check (state <> 'WAIVED' or resolution_reason is not null)
);

create table audit_event (
  tenant_id uuid not null,
  audit_event_id uuid not null,
  occurred_at timestamptz not null,
  actor_user_id uuid,
  action_code varchar(128) not null,
  resource_type varchar(96) not null,
  resource_id uuid not null,
  patient_ref_hash char(64),
  trace_id varchar(64) not null,
  previous_hash char(64),
  event_hash char(64) not null,
  details jsonb not null default '{}'::jsonb,
  primary key (tenant_id, audit_event_id),
  unique (tenant_id, event_hash),
  foreign key (tenant_id, actor_user_id) references app_user(tenant_id, user_id)
);

create table outbox_event (
  tenant_id uuid not null,
  event_id uuid not null,
  aggregate_type varchar(96) not null,
  aggregate_id uuid not null,
  aggregate_version bigint not null check (aggregate_version > 0),
  event_type varchar(128) not null,
  schema_version integer not null check (schema_version > 0),
  payload jsonb not null,
  available_at timestamptz not null default now(),
  published_at timestamptz,
  attempt integer not null default 0 check (attempt >= 0),
  last_error_code varchar(128),
  created_at timestamptz not null default now(),
  primary key (tenant_id, event_id),
  unique (tenant_id, aggregate_type, aggregate_id, aggregate_version, event_type),
  foreign key (tenant_id) references tenant(tenant_id)
);

create index outbox_event_pending_idx
  on outbox_event (available_at, event_id)
  where published_at is null;

create table idempotency_record (
  tenant_id uuid not null,
  command_scope varchar(128) not null,
  idempotency_key varchar(128) not null,
  request_hash char(64) not null,
  state varchar(24) not null check (state in ('IN_PROGRESS', 'SUCCEEDED', 'FAILED_FINAL', 'RECONCILING')),
  response_status integer,
  response_ref jsonb,
  trace_id varchar(64) not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (tenant_id, command_scope, idempotency_key),
  foreign key (tenant_id) references tenant(tenant_id),
  check (expires_at > created_at)
);

create index encounter_patient_timeline_idx on encounter (tenant_id, patient_id, started_at desc);
create index document_encounter_idx on clinical_document (tenant_id, encounter_id, updated_at desc);
create index quality_open_idx on quality_finding (tenant_id, severity, created_at) where state = 'OPEN';
create index audit_resource_idx on audit_event (tenant_id, resource_type, resource_id, occurred_at);

