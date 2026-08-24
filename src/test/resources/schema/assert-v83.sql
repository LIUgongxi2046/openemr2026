do $$
begin
  if to_regclass('emergency_resuscitation') is null then
    raise exception 'V83 emergency_resuscitation table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'emergency_resuscitation_immutable'
  ) then
    raise exception 'V83 emergency resuscitation immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'emergency_resuscitation_patient_idx'
  ) then
    raise exception 'V83 emergency resuscitation index missing';
  end if;
end $$;
