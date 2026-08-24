do $$
begin
  if to_regclass('emergency_preadmission') is null then
    raise exception 'V90 emergency_preadmission table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'emergency_preadmission_immutable'
  ) then
    raise exception 'V90 emergency preadmission immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'emergency_preadmission_facility_idx'
  ) then
    raise exception 'V90 emergency preadmission index missing';
  end if;
end $$;
