do $$
begin
  if to_regclass('infection_monitoring_event') is null then
    raise exception 'V74 infection_monitoring_event table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'infection_event_immutable'
  ) then
    raise exception 'V74 infection event immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'infection_event_patient_idx'
  ) then
    raise exception 'V74 infection event index missing';
  end if;
end $$;
