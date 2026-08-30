-- 仿真模型仅用于页面与治理流程演示，不能伪装成已连接的真实模型参与 Eva 路由。
-- 保留历史模型与评测证据，只清除凭据引用并退出当前运行选择。
update model_deployment
set api_key_ref = null,
    connection_status = 'NOT_CONFIGURED',
    status = 'INACTIVE',
    evaluation_status = 'REJECTED',
    last_connection_error_code = 'SYNTHETIC_CONFIGURATION_RETIRED',
    row_version = row_version + 1,
    updated_at = now()
where endpoint_url like 'https://%.example/%'
  and (api_key_ref is not null
    or connection_status <> 'NOT_CONFIGURED'
    or status <> 'INACTIVE'
    or evaluation_status <> 'REJECTED');
