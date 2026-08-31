-- A previously interrupted integration test may leave its synthetic model and
-- cloud-processing approval active in a shared development database. Preserve
-- the audit rows, but make them impossible to select for clinical work.
update medical_ai_external_processing_approval
set status = 'REVOKED',
    revoked_by = '018f0000-0000-7000-8000-00000000aa04'::uuid,
    revoked_at = now(),
    revocation_reason = '集成测试专用模型已退出临床选择',
    row_version = row_version + 1
where tenant_id = '018f0000-0000-7000-8000-00000000aa01'::uuid
  and model_deployment_id = '018f0000-0000-7000-8000-00000000ff02'::uuid
  and status = 'ACTIVE';

update model_deployment
set status = 'INACTIVE',
    connection_status = 'NOT_CONFIGURED',
    evaluation_status = 'REJECTED',
    api_key_ref = null,
    last_connection_error_code = 'TEST_FIXTURE_RETIRED',
    row_version = row_version + 1,
    updated_at = now()
where tenant_id = '018f0000-0000-7000-8000-00000000aa01'::uuid
  and model_deployment_id = '018f0000-0000-7000-8000-00000000ff02'::uuid
  and model_code = 'TEST-AGENT-SYNTHETIC';
