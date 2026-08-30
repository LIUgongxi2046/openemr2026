alter table model_deployment
  drop constraint if exists model_deployment_connection_status_check,
  drop constraint if exists model_deployment_api_configuration_check;

alter table model_deployment
  add column last_connection_tested_at timestamptz,
  add column last_connection_latency_ms bigint
    check (last_connection_latency_ms is null or last_connection_latency_ms >= 0),
  add column last_connection_error_code varchar(128),
  add constraint model_deployment_connection_status_check
    check (connection_status in ('NOT_CONFIGURED', 'UNVERIFIED', 'READY', 'FAILED')),
  add constraint model_deployment_api_configuration_check check (
    (api_key_ref is null and connection_status = 'NOT_CONFIGURED')
    or (endpoint_url is not null and api_key_ref is not null
      and connection_status in ('UNVERIFIED', 'READY', 'FAILED'))
  );

create table medical_agent_tool_invocation (
  tenant_id uuid not null,
  invocation_id uuid not null,
  root_run_id uuid not null,
  child_run_id uuid not null,
  tool_code varchar(128) not null,
  tool_version varchar(64) not null,
  authorization_watermark char(64) not null,
  input_hash char(64) not null,
  result_hash char(64),
  item_count integer not null default 0 check (item_count >= 0),
  outcome varchar(24) not null check (outcome in ('SUCCEEDED', 'DENIED', 'FAILED')),
  duration_ms bigint not null check (duration_ms >= 0),
  error_code varchar(128),
  invoked_at timestamptz not null default now(),
  completed_at timestamptz not null default now(),
  primary key (tenant_id, invocation_id),
  foreign key (tenant_id, root_run_id)
    references medical_agent_run(tenant_id, run_id),
  foreign key (tenant_id, child_run_id)
    references medical_agent_child_run(tenant_id, child_run_id),
  check ((outcome = 'SUCCEEDED') = (result_hash is not null)),
  check ((outcome = 'FAILED') = (error_code is not null))
);

create index medical_agent_tool_invocation_run_idx
  on medical_agent_tool_invocation(tenant_id, root_run_id, invoked_at, invocation_id);

alter table medical_agent_run
  add column model_prompt_tokens bigint not null default 0 check (model_prompt_tokens >= 0),
  add column model_completion_tokens bigint not null default 0 check (model_completion_tokens >= 0),
  add column model_total_tokens bigint not null default 0 check (model_total_tokens >= 0),
  add column actual_duration_ms bigint not null default 0 check (actual_duration_ms >= 0),
  add column model_request_count integer not null default 0 check (model_request_count >= 0),
  add column tool_call_count integer not null default 0 check (tool_call_count >= 0);

insert into tool_registry(
  tenant_id, tool_registry_id, tool_code, tool_name, tool_version, tool_type, status)
select synthetic_tenant.tenant_id, seed.id::uuid, seed.code, seed.name, '1.0.0', 'DATABASE_QUERY', 'ACTIVE'
from (values
  ('018f0000-0000-7000-8000-00000000f221', 'CLINICAL_DOCUMENT_READ', '当前就诊文书版本读取'),
  ('018f0000-0000-7000-8000-00000000f222', 'CLINICAL_ORDER_READ', '当前就诊医嘱读取'),
  ('018f0000-0000-7000-8000-00000000f223', 'CLINICAL_RESULT_READ', '当前就诊结果读取'),
  ('018f0000-0000-7000-8000-00000000f224', 'CLINICAL_TASK_READ', '当前就诊任务读取'),
  ('018f0000-0000-7000-8000-00000000f225', 'CLINICAL_ATTACHMENT_READ', '当前就诊附件元数据读取')
) as seed(id, code, name)
join tenant synthetic_tenant
  on synthetic_tenant.tenant_id = '018f0000-0000-7000-8000-00000000aa01'::uuid
on conflict (tenant_id, tool_code, tool_version) do nothing;

update model_deployment
set last_connection_tested_at = coalesce(last_connection_tested_at, now()),
    last_connection_latency_ms = coalesce(last_connection_latency_ms, 0),
    last_connection_error_code = 'SYNTHETIC_CONFIGURATION'
where tenant_id = '018f0000-0000-7000-8000-00000000aa01'::uuid
  and endpoint_url like 'https://ai-gateway.tertiary-hospital.example/%'
  and connection_status = 'READY';
