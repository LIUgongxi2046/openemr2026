do $$
begin
  if to_regclass('agent_dependency') is null then
    raise exception 'V94 agent_dependency table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'agent_dependency_immutable'
  ) then
    raise exception 'V94 agent dependency immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'agent_dependency_agent_idx'
  ) then
    raise exception 'V94 agent dependency index missing';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'agent_dependency'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) like '%agent_registry_id%'
        and pg_get_constraintdef(oid) like '%dependency_type%'
        and pg_get_constraintdef(oid) like '%dependency_code%'
  ) then
    raise exception 'V94 agent dependency unique constraint missing';
  end if;
end $$;
