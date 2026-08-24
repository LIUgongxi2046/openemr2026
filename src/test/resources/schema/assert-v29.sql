do $$
declare required_table text;
begin
  foreach required_table in array array['patient_demographic_version', 'patient_match_candidate', 'patient_merge_case'] loop
    if not exists (
      select 1 from information_schema.tables
      where table_schema = current_schema() and table_name = required_table
    ) then
      raise exception 'V29 table % missing', required_table;
    end if;
  end loop;
  if not exists (select 1 from pg_trigger where tgname = 'patient_demographic_version_immutable') then
    raise exception 'V29 immutable demographic history trigger missing';
  end if;
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = current_schema() and table_name = 'patient'
      and constraint_name = 'patient_identity_status_ck'
  ) then
    raise exception 'V29 patient identity status constraint missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = current_schema() and table_name = 'patient_merge_case'
      and column_name = 'source_status_before_merge'
  ) then
    raise exception 'V29 reversible merge source status snapshot missing';
  end if;
end $$;
