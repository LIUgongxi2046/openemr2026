do $$
begin
  if to_regclass('waiting_queue_entry') is null then
    raise exception 'V41 waiting_queue_entry table missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'appointment' and column_name = 'check_in_at'
  ) then
    raise exception 'V41 appointment check_in_at column missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'waiting_queue_facility_date_idx'
  ) then
    raise exception 'V41 waiting queue index missing';
  end if;
end $$;
