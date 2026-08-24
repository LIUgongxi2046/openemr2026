do $$
begin
  if to_regclass('agent_run_budget') is null then
    raise exception 'V88 agent_run_budget table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'agent_run_budget_immutable'
  ) then
    raise exception 'V88 agent run budget immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'agent_run_budget_status_idx'
  ) then
    raise exception 'V88 agent run budget index missing';
  end if;
end $$;
