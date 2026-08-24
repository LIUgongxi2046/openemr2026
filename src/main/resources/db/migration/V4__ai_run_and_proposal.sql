create table ai_use_case_policy (
  tenant_id uuid not null,
  use_case_code varchar(96) not null,
  enabled boolean not null default false,
  provider_code varchar(96) not null,
  model_code varchar(128) not null,
  model_residency_policy varchar(32) not null,
  prompt_version varchar(64) not null,
  config_version bigint not null default 1 check (config_version > 0),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, use_case_code),
  foreign key (tenant_id) references tenant(tenant_id),
  check (model_residency_policy in ('ON_PREM_ONLY', 'CN_REGION_ONLY', 'APPROVED_EXTERNAL'))
);

create table ai_run (
  tenant_id uuid not null,
  run_id uuid not null,
  context_lease_id uuid not null,
  use_case_code varchar(96) not null,
  document_id uuid not null,
  document_version_id uuid not null,
  state varchar(32) not null,
  sequence bigint not null default 0 check (sequence >= 0),
  parameter_hash char(64) not null,
  data_watermark char(64) not null,
  provider_code varchar(96) not null,
  model_code varchar(128) not null,
  prompt_version varchar(64) not null,
  max_tool_calls integer not null check (max_tool_calls > 0),
  max_output_tokens integer not null check (max_output_tokens > 0),
  tool_call_count integer not null default 0 check (tool_call_count >= 0),
  deadline_at timestamptz not null,
  fencing_token bigint not null default 1 check (fencing_token > 0),
  error_code varchar(128),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version bigint not null default 1 check (row_version > 0),
  primary key (tenant_id, run_id),
  foreign key (tenant_id, context_lease_id) references context_lease(tenant_id, lease_id),
  foreign key (tenant_id, document_id, document_version_id)
    references clinical_document_version(tenant_id, document_id, document_version_id),
  foreign key (tenant_id, use_case_code) references ai_use_case_policy(tenant_id, use_case_code),
  check (state in ('CREATED', 'ROUTING', 'RETRIEVING', 'PLANNING', 'WAITING_APPROVAL',
    'GENERATING', 'VERIFYING', 'READY_FOR_REVIEW', 'ACCEPTED', 'REJECTED', 'EXPIRED',
    'RETRYING', 'DEGRADED', 'RECONCILING', 'COMPLETED', 'FAILED', 'BLOCKED', 'CANCELLED')),
  check (deadline_at > created_at),
  check (tool_call_count <= max_tool_calls)
);

create table ai_proposal (
  tenant_id uuid not null,
  proposal_id uuid not null,
  run_id uuid not null,
  proposal_type varchar(96) not null,
  status varchar(32) not null,
  payload jsonb not null,
  context_references jsonb not null,
  authorization_watermark char(64) not null,
  expires_at timestamptz not null,
  decided_by uuid,
  decided_at timestamptz,
  decision_reason text,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  primary key (tenant_id, proposal_id),
  foreign key (tenant_id, run_id) references ai_run(tenant_id, run_id),
  foreign key (tenant_id, decided_by) references app_user(tenant_id, user_id),
  check (status in ('PENDING_REVIEW', 'ACCEPTED', 'MODIFIED', 'REJECTED', 'EXPIRED')),
  check ((decided_at is null) = (decided_by is null))
);

create table ai_run_event (
  tenant_id uuid not null,
  run_id uuid not null,
  sequence bigint not null check (sequence > 0),
  event_id uuid not null,
  event_type varchar(96) not null,
  payload jsonb not null,
  occurred_at timestamptz not null default now(),
  primary key (tenant_id, run_id, sequence),
  unique (tenant_id, event_id),
  foreign key (tenant_id, run_id) references ai_run(tenant_id, run_id)
);

create table ai_tool_invocation (
  tenant_id uuid not null,
  invocation_id uuid not null,
  run_id uuid not null,
  tool_code varchar(96) not null,
  source_type varchar(64) not null,
  source_id uuid not null,
  source_version varchar(128) not null,
  authorization_watermark char(64) not null,
  outcome varchar(24) not null,
  invoked_at timestamptz not null default now(),
  primary key (tenant_id, invocation_id),
  foreign key (tenant_id, run_id) references ai_run(tenant_id, run_id),
  check (outcome in ('ALLOWED', 'DENIED', 'FAILED'))
);

create index ai_run_active_idx on ai_run (tenant_id, state, deadline_at)
  where state not in ('ACCEPTED', 'REJECTED', 'EXPIRED', 'COMPLETED', 'FAILED', 'BLOCKED', 'CANCELLED');
create index ai_proposal_review_idx on ai_proposal (tenant_id, status, expires_at)
  where status = 'PENDING_REVIEW';
