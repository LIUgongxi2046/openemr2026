do $$
begin
  if to_regclass('agent_registry') is null then
    raise exception 'V80 agent_registry table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'agent_registry_immutable'
  ) then
    raise exception 'V80 agent registry immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'agent_registry_status_idx'
  ) then
    raise exception 'V80 agent registry index missing';
  end if;
end $$;
