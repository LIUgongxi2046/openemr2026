do $$
begin
  if to_regclass('release_metric_snapshot') is null then
    raise exception 'V110 release_metric_snapshot table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'release_metric_immutable'
  ) then
    raise exception 'V110 release metric immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'release_metric_type_idx'
  ) then
    raise exception 'V110 release metric index missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'release_metric_value_check'
  ) then
    raise exception 'V110 release metric value constraint missing';
  end if;
end $$;
