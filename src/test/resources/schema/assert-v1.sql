do $schema_assert$
declare
  required_table text;
begin
  foreach required_table in array array[
    'tenant', 'organization', 'facility', 'app_user', 'role_assignment',
    'patient', 'patient_identifier', 'encounter', 'clinical_document',
    'clinical_document_version', 'signature_evidence', 'quality_finding',
    'audit_event', 'outbox_event', 'idempotency_record'
  ] loop
    if to_regclass(required_table) is null then
      raise exception 'missing required table: %', required_table;
    end if;
  end loop;
end
$schema_assert$;

insert into tenant values
  ('00000000-0000-7000-8000-000000000001', 'T1', '合成租户一', 'ACTIVE', now()),
  ('00000000-0000-7000-8000-000000000002', 'T2', '合成租户二', 'ACTIVE', now());

insert into organization values
  ('00000000-0000-7000-8000-000000000001', '00000000-0000-7000-8000-000000000011', 'ORG1', '合成医院一', 'ACTIVE'),
  ('00000000-0000-7000-8000-000000000002', '00000000-0000-7000-8000-000000000012', 'ORG2', '合成医院二', 'ACTIVE');

insert into facility values
  ('00000000-0000-7000-8000-000000000001', '00000000-0000-7000-8000-000000000011', '00000000-0000-7000-8000-000000000021', 'F1', '合成院区一', 'Asia/Shanghai', 'ACTIVE'),
  ('00000000-0000-7000-8000-000000000002', '00000000-0000-7000-8000-000000000012', '00000000-0000-7000-8000-000000000022', 'F2', '合成院区二', 'Asia/Shanghai', 'ACTIVE');

insert into app_user values
  ('00000000-0000-7000-8000-000000000001', '00000000-0000-7000-8000-000000000031', 'synthetic-doctor-1', '合成医生', 'ACTIVE'),
  ('00000000-0000-7000-8000-000000000002', '00000000-0000-7000-8000-000000000032', 'synthetic-doctor-2', '合成医生二', 'ACTIVE');

insert into patient values
  ('00000000-0000-7000-8000-000000000001', '00000000-0000-7000-8000-000000000041', '合成患者甲', 'F', date '1990-01-01', 'ACTIVE', null, 1, now(), now()),
  ('00000000-0000-7000-8000-000000000002', '00000000-0000-7000-8000-000000000042', '合成患者乙', 'M', date '1980-01-01', 'ACTIVE', null, 1, now(), now());

insert into patient_identifier values
  ('00000000-0000-7000-8000-000000000001', '00000000-0000-7000-8000-000000000051', '00000000-0000-7000-8000-000000000041', 'SYNTHETIC', 'MRN', decode('01', 'hex'), 'S***1', 'SYNTHETIC', true);

do $constraint_assert$
begin
  begin
    insert into patient_identifier values
      ('00000000-0000-7000-8000-000000000001', '00000000-0000-7000-8000-000000000052', '00000000-0000-7000-8000-000000000041', 'SYNTHETIC', 'MRN', decode('01', 'hex'), 'S***1', 'SYNTHETIC', true);
    raise exception 'duplicate patient identifier was accepted';
  exception when unique_violation then
    null;
  end;

  begin
    insert into encounter values
      ('00000000-0000-7000-8000-000000000001', '00000000-0000-7000-8000-000000000061', '00000000-0000-7000-8000-000000000042', '00000000-0000-7000-8000-000000000011', '00000000-0000-7000-8000-000000000021', 'OUTPATIENT', 'IN_PROGRESS', now(), null, 'SYNTHETIC', 'CROSS-TENANT', 1, now(), now());
    raise exception 'cross-tenant patient encounter was accepted';
  exception when foreign_key_violation then
    null;
  end;

  begin
    insert into encounter values
      ('00000000-0000-7000-8000-000000000001', '00000000-0000-7000-8000-000000000062', '00000000-0000-7000-8000-000000000041', '00000000-0000-7000-8000-000000000011', '00000000-0000-7000-8000-000000000021', 'OUTPATIENT', 'UNKNOWN', now(), null, 'SYNTHETIC', 'BAD-STATE', 1, now(), now());
    raise exception 'invalid encounter state was accepted';
  exception when check_violation then
    null;
  end;
end
$constraint_assert$;

insert into idempotency_record values
  ('00000000-0000-7000-8000-000000000001', 'DOCUMENT_SAVE', 'idem-1', repeat('a', 64), 'IN_PROGRESS', null, null, 'trace-1', now(), now() + interval '1 hour');

do $idempotency_assert$
begin
  begin
    insert into idempotency_record values
      ('00000000-0000-7000-8000-000000000001', 'DOCUMENT_SAVE', 'idem-1', repeat('a', 64), 'IN_PROGRESS', null, null, 'trace-2', now(), now() + interval '1 hour');
    raise exception 'duplicate idempotency key was accepted';
  exception when unique_violation then
    null;
  end;
end
$idempotency_assert$;
