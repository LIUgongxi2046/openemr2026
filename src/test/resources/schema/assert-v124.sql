do $$
begin
  if to_regclass('action_execution') is null then
    raise exception 'V124 action_execution table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'action_execution_immutable'
  ) then
    raise exception 'V124 action execution immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'action_execution_failure_check'
  ) then
    raise exception 'V124 action execution failure constraint missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'action_execution_status_check'
  ) then
    raise exception 'V124 action execution status constraint missing';
  end if;
end $$;
