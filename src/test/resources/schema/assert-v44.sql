do $$
begin
  if to_regclass('nursing_care_plan') is null then
    raise exception 'V44 nursing_care_plan table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'nursing_care_plan_immutable'
  ) then
    raise exception 'V44 nursing care plan immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'nursing_care_plan_encounter_idx'
  ) then
    raise exception 'V44 nursing care plan index missing';
  end if;
end $$;
