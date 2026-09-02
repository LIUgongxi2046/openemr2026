create table quality_governance_record (
  tenant_id uuid not null,
  quality_governance_record_id uuid not null,
  organization_id uuid not null,
  facility_id uuid not null,
  module_code varchar(32) not null check (module_code in (
    'QUALITY_CENTER','DEPARTMENT_QC','QUALITY_RATING','INFECTION_EVENTS','CREDENTIALS')),
  parent_resource_id uuid not null,
  hierarchy_level integer not null check (hierarchy_level between 5 and 7),
  record_kind varchar(24) not null check (record_kind in ('ACTION','EVIDENCE','REVIEW')),
  record_code varchar(96) not null check (length(trim(record_code)) between 2 and 96),
  title varchar(256) not null check (length(trim(title)) between 2 and 256),
  owner varchar(128) not null check (length(trim(owner)) between 2 and 128),
  status varchar(24) not null check (status in ('OPEN','IN_PROGRESS','READY','VERIFIED','REJECTED','CLOSED')),
  due_at timestamptz,
  description varchar(2000) not null check (length(trim(description)) between 4 and 2000),
  evidence_uri varchar(1000),
  evidence_hash char(64),
  payload jsonb not null default '{}'::jsonb,
  row_version bigint not null default 1 check (row_version > 0),
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid,
  void_reason varchar(500),
  primary key (tenant_id, quality_governance_record_id),
  foreign key (tenant_id) references tenant(tenant_id),
  foreign key (tenant_id, organization_id) references organization(tenant_id, organization_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, created_by) references app_user(tenant_id, user_id),
  foreign key (tenant_id, updated_by) references app_user(tenant_id, user_id),
  foreign key (tenant_id, voided_by) references app_user(tenant_id, user_id),
  check ((hierarchy_level = 5 and record_kind = 'ACTION')
      or (hierarchy_level = 6 and record_kind = 'EVIDENCE')
      or (hierarchy_level = 7 and record_kind = 'REVIEW')),
  check (evidence_hash is null or evidence_hash ~ '^[0-9a-f]{64}$'),
  check (evidence_uri is null or evidence_uri ~ '^(https://|urn:|archive://|document://|config://)'),
  check ((voided_at is null and voided_by is null and void_reason is null)
      or (voided_at is not null and voided_by is not null and length(trim(void_reason)) >= 8)),
  check (record_kind <> 'EVIDENCE' or status not in ('OPEN','IN_PROGRESS')
      or evidence_uri is not null or evidence_hash is not null)
);

create unique index quality_governance_record_active_code_uq
  on quality_governance_record (tenant_id, module_code, parent_resource_id, record_kind, record_code)
  where voided_at is null;

create index quality_governance_record_parent_idx
  on quality_governance_record (
    tenant_id, organization_id, facility_id, module_code, parent_resource_id,
    hierarchy_level, status, due_at, updated_at desc)
  where voided_at is null;

create table quality_governance_agent_proposal (
  tenant_id uuid not null,
  quality_governance_agent_proposal_id uuid not null,
  organization_id uuid not null,
  facility_id uuid not null,
  module_code varchar(32) not null check (module_code in (
    'QUALITY_CENTER','DEPARTMENT_QC','QUALITY_RATING','INFECTION_EVENTS','CREDENTIALS')),
  parent_resource_id uuid not null,
  evidence_watermark char(64) not null check (evidence_watermark ~ '^[0-9a-f]{64}$'),
  risk_level varchar(16) not null check (risk_level in ('LOW','MEDIUM','HIGH','CRITICAL')),
  summary varchar(2000) not null check (length(trim(summary)) >= 8),
  prioritized_actions jsonb not null check (jsonb_typeof(prioritized_actions) = 'array'),
  model_policy varchar(64) not null default 'DETERMINISTIC_QUALITY_RULES_V1',
  human_review_state varchar(16) not null default 'PENDING'
    check (human_review_state in ('PENDING','ACCEPTED','REJECTED')),
  generated_by uuid not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, quality_governance_agent_proposal_id),
  foreign key (tenant_id) references tenant(tenant_id),
  foreign key (tenant_id, organization_id) references organization(tenant_id, organization_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, generated_by) references app_user(tenant_id, user_id)
);

create index quality_governance_agent_parent_idx
  on quality_governance_agent_proposal (
    tenant_id, organization_id, facility_id, module_code, parent_resource_id, created_at desc);
