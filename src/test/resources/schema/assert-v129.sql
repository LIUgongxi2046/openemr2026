do $$
begin
  if to_regclass('historical_migration_checkpoint') is null then
    raise exception 'V129 historical_migration_checkpoint table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'historical_migration_checkpoint_immutable'
  ) then
    raise exception 'V129 historical migration checkpoint immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'historical_migration_checkpoint_processed_records_check'
  ) then
    raise exception 'V129 historical migration checkpoint processed_records check missing';
  end if;
end $$;
