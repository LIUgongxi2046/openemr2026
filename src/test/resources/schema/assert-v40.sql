do $$
begin
  if to_regclass('schedule_slot') is null or to_regclass('appointment') is null
      or to_regclass('appointment_event') is null then
    raise exception 'V40 appointment scheduling tables missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'appointment_event_immutable'
  ) then
    raise exception 'V40 appointment event immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'schedule_slot_unique_window_idx'
  ) or not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'appointment_slot_idx'
  ) then
    raise exception 'V40 appointment scheduling indexes missing';
  end if;
end $$;
