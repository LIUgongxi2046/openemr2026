alter table dev_user_credential
  add column password_changed_at timestamptz not null default now(),
  add column require_password_change boolean not null default false;

create table master_data_record (
  tenant_id uuid not null,
  record_id uuid not null,
  config_id uuid not null,
  code_system varchar(128) not null,
  national_code varchar(128),
  local_code varchar(128) not null,
  display_name varchar(256) not null,
  category_path varchar(512) not null,
  national_version varchar(64),
  authoritative_source varchar(256) not null,
  mapping_status varchar(24) not null default 'MATCHED',
  status varchar(24) not null default 'ACTIVE',
  effective_from timestamptz not null,
  effective_until timestamptz,
  attributes jsonb not null default '{}'::jsonb,
  row_version bigint not null default 1,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, record_id),
  unique (tenant_id, code_system, local_code),
  foreign key (tenant_id, config_id) references config_item(tenant_id, config_id),
  foreign key (tenant_id, created_by) references app_user(tenant_id, user_id),
  check (length(trim(local_code)) > 0),
  check (length(trim(display_name)) > 0),
  check (mapping_status in ('MATCHED', 'UNMATCHED', 'CONFLICT', 'LOCAL_ONLY')),
  check (status in ('ACTIVE', 'INACTIVE')),
  check (row_version > 0),
  check (effective_until is null or effective_until > effective_from)
);

create index master_data_record_config_idx
  on master_data_record (tenant_id, config_id, status, category_path, local_code);

create index master_data_record_national_idx
  on master_data_record (tenant_id, code_system, national_code)
  where national_code is not null;

create table administration_workgroup (
  tenant_id uuid not null,
  workgroup_id uuid not null,
  workgroup_code varchar(128) not null,
  display_name varchar(256) not null,
  purpose varchar(512) not null,
  organization_id uuid not null,
  facility_id uuid,
  department_id uuid,
  owner_person_id uuid not null,
  status varchar(24) not null default 'ACTIVE',
  effective_from timestamptz not null,
  effective_until timestamptz,
  row_version bigint not null default 1,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, workgroup_id),
  unique (tenant_id, workgroup_code),
  foreign key (tenant_id, organization_id) references organization(tenant_id, organization_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, owner_person_id) references workforce_person(tenant_id, person_id),
  foreign key (tenant_id, created_by) references app_user(tenant_id, user_id),
  check (status in ('ACTIVE', 'INACTIVE')),
  check (row_version > 0),
  check (effective_until is null or effective_until > effective_from)
);

create table administration_workgroup_member (
  tenant_id uuid not null,
  member_id uuid not null,
  workgroup_id uuid not null,
  person_id uuid not null,
  role_code varchar(64) not null,
  responsibility varchar(512) not null,
  status varchar(24) not null default 'ACTIVE',
  effective_from timestamptz not null,
  effective_until timestamptz,
  row_version bigint not null default 1,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, member_id),
  unique (tenant_id, workgroup_id, person_id, role_code),
  foreign key (tenant_id, workgroup_id) references administration_workgroup(tenant_id, workgroup_id),
  foreign key (tenant_id, person_id) references workforce_person(tenant_id, person_id),
  foreign key (tenant_id, created_by) references app_user(tenant_id, user_id),
  check (status in ('ACTIVE', 'INACTIVE')),
  check (row_version > 0),
  check (effective_until is null or effective_until > effective_from)
);

create index administration_workgroup_member_person_idx
  on administration_workgroup_member (tenant_id, person_id, status, effective_until);

create table administration_job_run (
  tenant_id uuid not null,
  run_id uuid not null,
  config_id uuid not null,
  job_kind varchar(64) not null,
  status varchar(24) not null default 'QUEUED',
  requested_by uuid not null,
  idempotency_key varchar(128) not null,
  attempt integer not null default 0,
  processed_count integer not null default 0,
  succeeded_count integer not null default 0,
  failed_count integer not null default 0,
  result jsonb not null default '{}'::jsonb,
  error_code varchar(128),
  error_message varchar(1000),
  started_at timestamptz,
  finished_at timestamptz,
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, run_id),
  unique (tenant_id, idempotency_key),
  foreign key (tenant_id, config_id) references config_item(tenant_id, config_id),
  foreign key (tenant_id, requested_by) references app_user(tenant_id, user_id),
  check (status in ('QUEUED', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED')),
  check (attempt >= 0 and processed_count >= 0 and succeeded_count >= 0 and failed_count >= 0),
  check (row_version > 0),
  check ((finished_at is null) or status in ('SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED'))
);

create index administration_job_run_queue_idx
  on administration_job_run (status, created_at, tenant_id)
  where status in ('QUEUED', 'RUNNING');

create table administration_governance_finding (
  tenant_id uuid not null,
  finding_id uuid not null,
  run_id uuid not null,
  finding_type varchar(64) not null,
  severity varchar(16) not null,
  resource_type varchar(64) not null,
  resource_id uuid,
  summary varchar(500) not null,
  recommendation varchar(1000) not null,
  evidence jsonb not null default '{}'::jsonb,
  status varchar(24) not null default 'OPEN',
  resolved_by uuid,
  resolved_at timestamptz,
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, finding_id),
  foreign key (tenant_id, run_id) references administration_job_run(tenant_id, run_id),
  foreign key (tenant_id, resolved_by) references app_user(tenant_id, user_id),
  check (severity in ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  check (status in ('OPEN', 'ACKNOWLEDGED', 'RESOLVED')),
  check (row_version > 0),
  check ((resolved_at is null) = (resolved_by is null))
);

create index administration_governance_finding_run_idx
  on administration_governance_finding (tenant_id, run_id, severity, status);
