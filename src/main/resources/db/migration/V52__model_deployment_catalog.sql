create table model_deployment (
  tenant_id uuid not null,
  model_deployment_id uuid not null,
  model_code varchar(128) not null,
  provider_code varchar(64) not null,
  display_name varchar(256) not null check (length(trim(display_name)) > 0),
  residency_policy varchar(32) not null check (residency_policy in ('ON_PREM_ONLY', 'LOCAL_PREFERRED', 'CLOUD_ALLOWED')),
  endpoint_url varchar(512),
  status varchar(16) not null check (status in ('ACTIVE', 'INACTIVE')),
  evaluation_status varchar(16) not null check (evaluation_status in ('EVALUATING', 'APPROVED', 'REJECTED')),
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, model_deployment_id),
  unique (tenant_id, model_code),
  check (residency_policy <> 'CLOUD_ALLOWED' or endpoint_url is not null)
);

create index model_deployment_active_idx
  on model_deployment (tenant_id, status, residency_policy);

create function prevent_model_deployment_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'model deployment code and provider are immutable once registered';
end $$;

create trigger model_deployment_immutable
  before update of model_code, provider_code on model_deployment
  for each row execute function prevent_model_deployment_mutation();
