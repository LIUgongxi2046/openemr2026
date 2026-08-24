do $$
begin
  if to_regclass('agent_run_budget_consumption') is null then
    raise exception 'V132 agent_run_budget_consumption table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'agent_run_budget_consumption_immutable'
  ) then
    raise exception 'V132 agent run budget consumption immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'agent_run_budget_consumption_tokens_check'
  ) then
    raise exception 'V132 agent run budget consumption tokens check missing';
  end if;
end $$;
