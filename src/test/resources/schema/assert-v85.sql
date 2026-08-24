do $$
begin
  if to_regclass('tool_registry') is null then
    raise exception 'V85 tool_registry table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'tool_registry_immutable'
  ) then
    raise exception 'V85 tool registry immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'tool_registry_status_idx'
  ) then
    raise exception 'V85 tool registry index missing';
  end if;
end $$;
