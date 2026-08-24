do $$
begin
  if to_regclass('capability_pack_release') is null then
    raise exception 'V121 capability_pack_release table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'capability_pack_release_immutable'
  ) then
    raise exception 'V121 capability pack release immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'capability_pack_release_one_active_idx'
  ) then
    raise exception 'V121 capability pack release one-active index missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'capability_pack_release_rollback_check'
  ) then
    raise exception 'V121 capability pack release rollback constraint missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'capability_pack_release_canary_check'
  ) then
    raise exception 'V121 capability pack release canary constraint missing';
  end if;
end $$;
