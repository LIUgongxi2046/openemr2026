do $$
begin
  if to_regclass('metric_snapshot') is null then
    raise exception 'V165 metric_snapshot table missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'metric_snapshot_status_check'
  ) then
    raise exception 'V165 metric_snapshot status check missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'metric_snapshot_type_idx'
  ) then
    raise exception 'V165 metric_snapshot type index missing';
  end if;
end $$;
