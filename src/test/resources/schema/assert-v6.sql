do $schema_assert$
declare
  required_table text;
begin
  foreach required_table in array array[
    'clinical_department', 'specialty_pack_release', 'department_support_assessment'
  ] loop
    if to_regclass(required_table) is null then
      raise exception 'missing specialty support table: %', required_table;
    end if;
  end loop;
end
$schema_assert$;

insert into clinical_department(
  tenant_id, facility_id, department_id, department_code, display_name, status
) values (
  '00000000-0000-7000-8000-000000000001',
  '00000000-0000-7000-8000-000000000021',
  '00000000-0000-7000-8000-000000000801',
  'OBGYN', '合成妇产科', 'ACTIVE'
);

do $constraint_assert$
begin
  begin
    insert into department_support_assessment(
      tenant_id, department_support_assessment_id, facility_id, department_id,
      clinical_scope_code, support_level, assessed_by
    ) values (
      '00000000-0000-7000-8000-000000000001',
      '00000000-0000-7000-8000-000000000802',
      '00000000-0000-7000-8000-000000000021',
      '00000000-0000-7000-8000-000000000801',
      'OBGYN', 'BASIC_CLOSED_LOOP',
      '00000000-0000-7000-8000-000000000031'
    );
    raise exception 'positive support without evidence was accepted';
  exception when check_violation then
    null;
  end;
end
$constraint_assert$;
