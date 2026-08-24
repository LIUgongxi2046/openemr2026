do $schema_assert$
begin
  if to_regclass('context_lease') is null then
    raise exception 'missing required table: context_lease';
  end if;
end
$schema_assert$;

insert into role_assignment(
  tenant_id, role_assignment_id, user_id, organization_id, facility_id,
  role_code, valid_from, status
) values (
  '00000000-0000-7000-8000-000000000001',
  '00000000-0000-7000-8000-000000000071',
  '00000000-0000-7000-8000-000000000031',
  '00000000-0000-7000-8000-000000000011',
  '00000000-0000-7000-8000-000000000021',
  'CLINICIAN', now() - interval '1 hour', 'ACTIVE'
);

insert into context_lease(
  tenant_id, lease_id, organization_id, facility_id, user_id,
  role_assignment_ids, patient_id, purpose_code, allowed_source_types,
  authorization_watermark, data_classification_ceiling,
  model_residency_policy, issued_at, expires_at
) values (
  '00000000-0000-7000-8000-000000000001',
  '00000000-0000-7000-8000-000000000081',
  '00000000-0000-7000-8000-000000000011',
  '00000000-0000-7000-8000-000000000021',
  '00000000-0000-7000-8000-000000000031',
  array['00000000-0000-7000-8000-000000000071']::uuid[],
  '00000000-0000-7000-8000-000000000041',
  'DOCUMENT_DRAFT', array['DOCUMENT_VERSION'], repeat('a', 64),
  'SENSITIVE', 'ON_PREM_ONLY', now(), now() + interval '15 minutes'
);

do $constraint_assert$
begin
  begin
    insert into context_lease(
      tenant_id, lease_id, organization_id, facility_id, user_id,
      role_assignment_ids, purpose_code, allowed_source_types,
      authorization_watermark, data_classification_ceiling,
      model_residency_policy, issued_at, expires_at
    ) values (
      '00000000-0000-7000-8000-000000000001',
      '00000000-0000-7000-8000-000000000082',
      '00000000-0000-7000-8000-000000000011',
      '00000000-0000-7000-8000-000000000021',
      '00000000-0000-7000-8000-000000000031',
      array[]::uuid[], 'DOCUMENT_DRAFT', array['DOCUMENT_VERSION'], repeat('b', 64),
      'SENSITIVE', 'ON_PREM_ONLY', now(), now() + interval '15 minutes'
    );
    raise exception 'lease without a role was accepted';
  exception when check_violation then
    null;
  end;

  begin
    insert into context_lease(
      tenant_id, lease_id, organization_id, facility_id, user_id,
      role_assignment_ids, purpose_code, allowed_source_types,
      authorization_watermark, data_classification_ceiling,
      model_residency_policy, issued_at, expires_at
    ) values (
      '00000000-0000-7000-8000-000000000002',
      '00000000-0000-7000-8000-000000000083',
      '00000000-0000-7000-8000-000000000011',
      '00000000-0000-7000-8000-000000000022',
      '00000000-0000-7000-8000-000000000032',
      array['00000000-0000-7000-8000-000000000071']::uuid[],
      'DOCUMENT_DRAFT', array['DOCUMENT_VERSION'], repeat('c', 64),
      'SENSITIVE', 'ON_PREM_ONLY', now(), now() + interval '15 minutes'
    );
    raise exception 'cross-tenant lease was accepted';
  exception when foreign_key_violation then
    null;
  end;
end
$constraint_assert$;
