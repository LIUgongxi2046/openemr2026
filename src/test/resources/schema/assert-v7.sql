do $schema_assert$
declare
  required_table text;
begin
  foreach required_table in array array[
    'clinical_ward', 'clinical_bed', 'ward_role_scope', 'inpatient_admission',
    'bed_occupancy', 'inpatient_document_task'
  ] loop
    if to_regclass(required_table) is null then
      raise exception 'missing inpatient table: %', required_table;
    end if;
  end loop;
end
$schema_assert$;

insert into clinical_ward(tenant_id, facility_id, ward_id, ward_code, display_name, status)
values (
  '00000000-0000-7000-8000-000000000001',
  '00000000-0000-7000-8000-000000000021',
  '00000000-0000-7000-8000-000000000901', 'SYN-WARD', '合成病区', 'ACTIVE'
);
insert into clinical_bed(tenant_id, bed_id, ward_id, bed_label, status)
values (
  '00000000-0000-7000-8000-000000000001',
  '00000000-0000-7000-8000-000000000902',
  '00000000-0000-7000-8000-000000000901', '01', 'ACTIVE'
);

do $constraint_assert$
begin
  begin
    insert into inpatient_admission(
      tenant_id, admission_id, encounter_id, patient_id, facility_id, ward_id,
      current_bed_id, attending_user_id, status, admitted_at, discharged_at)
    values (
      '00000000-0000-7000-8000-000000000001',
      '00000000-0000-7000-8000-000000000903',
      '00000000-0000-7000-8000-000000000061',
      '00000000-0000-7000-8000-000000000042',
      '00000000-0000-7000-8000-000000000021',
      '00000000-0000-7000-8000-000000000901',
      '00000000-0000-7000-8000-000000000902',
      '00000000-0000-7000-8000-000000000031',
      'ADMITTED', now(), null)
    ;
    raise exception 'cross-tenant patient admission was accepted';
  exception when foreign_key_violation then
    null;
  end;
end
$constraint_assert$;
