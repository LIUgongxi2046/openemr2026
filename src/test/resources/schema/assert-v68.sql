do $$
begin
  if to_regclass('emergency_triage_assessment') is null then
    raise exception 'V68 emergency_triage_assessment table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'emergency_triage_immutable'
  ) then
    raise exception 'V68 emergency triage immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'emergency_triage_patient_idx'
  ) then
    raise exception 'V68 emergency triage index missing';
  end if;
end $$;
