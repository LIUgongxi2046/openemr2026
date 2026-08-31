create table configuration_runtime_execution (
  tenant_id uuid not null,
  execution_id uuid not null,
  config_id uuid not null,
  config_type varchar(64) not null,
  config_key varchar(128) not null,
  config_row_version bigint not null check (config_row_version > 0),
  operation varchar(32) not null check (operation in ('WORKFLOW_START', 'WORKFLOW_TRANSITION', 'FORM_VALIDATE', 'RULE_EVALUATE', 'SCOPE_AUTHORIZE')),
  subject_type varchar(64),
  subject_id uuid,
  state varchar(32) not null check (state in ('ACTIVE', 'COMPLETED', 'PASSED', 'BLOCKED', 'DENIED', 'FAILED')),
  current_node varchar(128),
  input_payload jsonb not null default '{}'::jsonb,
  output_payload jsonb not null default '{}'::jsonb,
  configuration_watermark varchar(256) not null,
  executed_by uuid not null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, execution_id),
  foreign key (tenant_id, config_id) references config_item(tenant_id, config_id),
  check ((subject_type is null) = (subject_id is null)),
  check (jsonb_typeof(input_payload) = 'object'),
  check (jsonb_typeof(output_payload) = 'object')
);

create index configuration_runtime_execution_config_idx
  on configuration_runtime_execution(tenant_id, config_type, config_key, created_at desc, execution_id);

create index configuration_runtime_execution_subject_idx
  on configuration_runtime_execution(tenant_id, subject_type, subject_id, created_at desc)
  where subject_id is not null;

insert into tool_registry(
  tenant_id, tool_registry_id, tool_code, tool_name, tool_version, tool_type, status)
select organization_tenant.tenant_id,
  '018f0000-0000-7000-8000-00000000f226'::uuid,
  'BUSINESS_CONFIGURATION_READ', '已发布业务配置与运行时证据读取', '1.0.0', 'DATABASE_QUERY', 'ACTIVE'
from tenant organization_tenant
on conflict (tenant_id, tool_code, tool_version) do nothing;
