do $$
begin
  if to_regclass('model_evaluation') is null then
    raise exception 'V87 model_evaluation table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'model_evaluation_immutable'
  ) then
    raise exception 'V87 model evaluation immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'model_evaluation_model_idx'
  ) then
    raise exception 'V87 model evaluation index missing';
  end if;
end $$;
