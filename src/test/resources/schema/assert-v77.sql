do $$
begin
  if to_regclass('data_quality_rule') is null then
    raise exception 'V77 data_quality_rule table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'data_quality_rule_immutable'
  ) then
    raise exception 'V77 data quality rule immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'data_quality_rule_dimension_idx'
  ) then
    raise exception 'V77 data quality rule index missing';
  end if;
end $$;
