do $$
declare required_table text;
begin
  foreach required_table in array array['authorization_policy', 'patient_care_relationship', 'emergency_access_grant'] loop
    if not exists (select 1 from information_schema.tables where table_schema = current_schema() and table_name = required_table) then
      raise exception 'V26 table % missing', required_table;
    end if;
  end loop;
  if not exists (select 1 from pg_trigger where tgname = 'emergency_access_expiry_sweep') then
    raise exception 'V26 emergency expiry trigger missing';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = current_schema() and indexname = 'authorization_policy_runtime_idx') then
    raise exception 'V26 authorization runtime index missing';
  end if;
end $$;
