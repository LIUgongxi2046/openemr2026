do $$
declare
  required_table text;
  required_trigger text;
begin
  foreach required_table in array array[
    'workforce_person', 'workforce_assignment', 'practitioner_credential'
  ] loop
    if not exists (
      select 1 from information_schema.tables
      where table_schema = current_schema() and table_name = required_table
    ) then
      raise exception 'V23 table % missing', required_table;
    end if;
  end loop;

  foreach required_trigger in array array[
    'organization_cycle_guard', 'clinical_department_cycle_guard',
    'app_user_person_compatibility', 'role_assignment_person_compatibility',
    'role_assignment_workforce_sync', 'signature_person_snapshot'
  ] loop
    if not exists (select 1 from pg_trigger where tgname = required_trigger) then
      raise exception 'V23 trigger % missing', required_trigger;
    end if;
  end loop;

  if exists (
    select 1 from app_user account
    left join workforce_person person
      on person.tenant_id = account.tenant_id and person.person_id = account.person_id
    where person.person_id is null
  ) then
    raise exception 'V23 app_user person backfill incomplete';
  end if;

  if exists (
    select 1 from role_assignment assignment
    join app_user account
      on account.tenant_id = assignment.tenant_id and account.user_id = assignment.user_id
    where assignment.person_id <> account.person_id
  ) then
    raise exception 'V23 role assignment person binding mismatch';
  end if;

  if exists (
    select 1 from clinical_ward ward
    left join clinical_department department
      on department.tenant_id = ward.tenant_id and department.facility_id = ward.facility_id
      and department.department_id = ward.department_id
    where department.department_id is null
  ) then
    raise exception 'V23 ward department backfill incomplete';
  end if;

  if not exists (select 1 from pg_indexes where indexname = 'workforce_assignment_scope_idx') then
    raise exception 'V23 workforce scope index missing';
  end if;
end $$;
