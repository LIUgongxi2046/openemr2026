do $$
begin
  if to_regclass('historical_migration_batch') is null then
    raise exception 'V115 historical_migration_batch table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'historical_migration_immutable'
  ) then
    raise exception 'V115 historical migration immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'historical_migration_source_idx'
  ) then
    raise exception 'V115 historical migration index missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'historical_migration_switch_check'
  ) then
    raise exception 'V115 historical migration switch constraint missing';
  end if;
end $$;
