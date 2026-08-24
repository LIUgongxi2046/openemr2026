do $$
begin
  if to_regclass('adverse_event') is null then
    raise exception 'V49 adverse_event table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'adverse_event_immutable'
  ) then
    raise exception 'V49 adverse event immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'adverse_event_encounter_idx'
  ) then
    raise exception 'V49 adverse event index missing';
  end if;
end $$;
