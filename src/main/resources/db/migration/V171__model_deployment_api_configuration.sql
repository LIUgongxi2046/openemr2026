alter table model_deployment
  add column api_key_ref varchar(512),
  add column connection_status varchar(24) not null default 'NOT_CONFIGURED'
    check (connection_status in ('NOT_CONFIGURED', 'READY'));

alter table model_deployment
  add constraint model_deployment_api_configuration_check check (
    (api_key_ref is null and connection_status = 'NOT_CONFIGURED')
    or (endpoint_url is not null and api_key_ref is not null and connection_status = 'READY')
  );

comment on column model_deployment.api_key_ref is
  'Secret reference only (env:// or file://); plaintext API keys are forbidden.';
