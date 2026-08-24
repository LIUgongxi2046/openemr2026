do $$
begin
  if to_regclass('capability_pack') is null then
    raise exception 'V82 capability_pack table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'capability_pack_immutable'
  ) then
    raise exception 'V82 capability pack immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'capability_pack_status_idx'
  ) then
    raise exception 'V82 capability pack index missing';
  end if;
end $$;
