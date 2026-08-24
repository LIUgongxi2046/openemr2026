do $$
begin
  if not exists (select 1 from information_schema.tables where table_name = 'clinical_result_version') then
    raise exception 'V17 clinical_result_version missing';
  end if;
  if not exists (select 1 from information_schema.tables where table_name = 'critical_value_case') then
    raise exception 'V17 critical_value_case missing';
  end if;
  if not exists (select 1 from pg_indexes where indexname = 'critical_value_case_state_idx') then
    raise exception 'V17 critical state index missing';
  end if;
end $$;
