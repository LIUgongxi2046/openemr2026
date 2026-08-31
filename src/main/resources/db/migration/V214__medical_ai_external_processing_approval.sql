create table medical_ai_external_processing_approval (
  tenant_id uuid not null,
  approval_id uuid not null,
  model_deployment_id uuid not null,
  legal_basis varchar(512) not null check (length(trim(legal_basis)) between 4 and 512),
  pia_reference varchar(256) not null check (length(trim(pia_reference)) between 4 and 256),
  processor_agreement_reference varchar(256) not null
    check (length(trim(processor_agreement_reference)) between 4 and 256),
  endpoint_region varchar(128) not null check (length(trim(endpoint_region)) between 2 and 128),
  retention_days integer not null check (retention_days between 0 and 3650),
  allowed_context_scopes text[] not null,
  status varchar(16) not null check (status in ('ACTIVE', 'REVOKED')),
  approved_by uuid not null,
  approved_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_by uuid,
  revoked_at timestamptz,
  revocation_reason varchar(500),
  row_version bigint not null default 1 check (row_version > 0),
  primary key (tenant_id, approval_id),
  foreign key (tenant_id, model_deployment_id)
    references model_deployment(tenant_id, model_deployment_id),
  foreign key (tenant_id, approved_by) references app_user(tenant_id, user_id),
  foreign key (tenant_id, revoked_by) references app_user(tenant_id, user_id),
  check (cardinality(allowed_context_scopes) > 0),
  check (allowed_context_scopes <@ array['RECORDS','ORDERS','RESULTS','TASKS','ATTACHMENTS','CONFIGURATION']::text[]),
  check (expires_at > approved_at),
  check ((status = 'ACTIVE' and revoked_by is null and revoked_at is null and revocation_reason is null)
    or (status = 'REVOKED' and revoked_by is not null and revoked_at is not null
      and length(trim(revocation_reason)) between 2 and 500))
);

create unique index medical_ai_external_processing_approval_active_idx
  on medical_ai_external_processing_approval(tenant_id, model_deployment_id)
  where status = 'ACTIVE';

create index medical_ai_external_processing_approval_expiry_idx
  on medical_ai_external_processing_approval(tenant_id, expires_at)
  where status = 'ACTIVE';

alter table medical_agent_run
  add column external_processing_approval_id uuid;

alter table medical_agent_run
  add constraint medical_agent_run_external_processing_approval_fk
  foreign key (tenant_id, external_processing_approval_id)
  references medical_ai_external_processing_approval(tenant_id, approval_id);

comment on table medical_ai_external_processing_approval is
  '云端模型处理诊疗数据前必须完成的单部署授权；未批准、过期或范围不足时 Agent 运行失败关闭。';
