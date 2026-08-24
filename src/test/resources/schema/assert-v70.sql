do $$
begin
  if to_regclass('emergency_observation') is null then
    raise exception 'V70 emergency_observation table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'emergency_observation_immutable'
  ) then
    raise exception 'V70 emergency observation immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'emergency_observation_patient_idx'
  ) then
    raise exception 'V70 emergency observation index missing';
  end if;
end $$;
