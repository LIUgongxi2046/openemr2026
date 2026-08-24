do $$
begin
  if to_regclass('model_deployment') is null then
    raise exception 'V52 model_deployment table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'model_deployment_immutable'
  ) then
    raise exception 'V52 model deployment immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'model_deployment_active_idx'
  ) then
    raise exception 'V52 model deployment index missing';
  end if;
end $$;
