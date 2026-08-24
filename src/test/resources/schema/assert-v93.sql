do $$
begin
  if to_regclass('data_quality_evaluation') is null then
    raise exception 'V93 data_quality_evaluation table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'data_quality_evaluation_immutable'
  ) then
    raise exception 'V93 data quality evaluation immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'data_quality_evaluation_rule_idx'
  ) then
    raise exception 'V93 data quality evaluation index missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'data_quality_evaluation_passed_check'
  ) then
    raise exception 'V93 data quality evaluation passed-state constraint missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'data_quality_evaluation_measured_value_check'
  ) then
    raise exception 'V93 data quality evaluation measured-value constraint missing';
  end if;
end $$;
