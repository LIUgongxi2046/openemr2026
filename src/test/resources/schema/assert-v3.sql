insert into encounter(
  tenant_id, encounter_id, patient_id, organization_id, facility_id,
  encounter_type, status, started_at, source_system, source_key
) values (
  '00000000-0000-7000-8000-000000000001',
  '00000000-0000-7000-8000-000000000091',
  '00000000-0000-7000-8000-000000000041',
  '00000000-0000-7000-8000-000000000011',
  '00000000-0000-7000-8000-000000000021',
  'OUTPATIENT', 'IN_PROGRESS', now(), 'SYNTHETIC', 'SIGNED-IMMUTABLE'
);

insert into clinical_document(
  tenant_id, document_id, patient_id, encounter_id, document_type_code,
  status, created_by
) values (
  '00000000-0000-7000-8000-000000000001',
  '00000000-0000-7000-8000-000000000092',
  '00000000-0000-7000-8000-000000000041',
  '00000000-0000-7000-8000-000000000091',
  'WS445.2.OUTPATIENT_RECORD', 'SIGNED',
  '00000000-0000-7000-8000-000000000031'
);

insert into clinical_document_version(
  tenant_id, document_id, document_version_id, version_no, status,
  sections, content_hash, author_user_id, signed_at
) values (
  '00000000-0000-7000-8000-000000000001',
  '00000000-0000-7000-8000-000000000092',
  '00000000-0000-7000-8000-000000000093', 1, 'SIGNED',
  '{"chief_complaint":"合成主诉"}', repeat('d', 64),
  '00000000-0000-7000-8000-000000000031', now()
);

update clinical_document
set current_version_id = '00000000-0000-7000-8000-000000000093'
where tenant_id = '00000000-0000-7000-8000-000000000001'
  and document_id = '00000000-0000-7000-8000-000000000092';

do $immutability_assert$
begin
  begin
    update clinical_document_version set sections = '{"chief_complaint":"覆盖"}'
    where tenant_id = '00000000-0000-7000-8000-000000000001'
      and document_version_id = '00000000-0000-7000-8000-000000000093';
    raise exception 'signed document version was updated';
  exception when check_violation then
    null;
  end;

  begin
    delete from clinical_document_version
    where tenant_id = '00000000-0000-7000-8000-000000000001'
      and document_version_id = '00000000-0000-7000-8000-000000000093';
    raise exception 'signed document version was deleted';
  exception when check_violation then
    null;
  end;
end
$immutability_assert$;
