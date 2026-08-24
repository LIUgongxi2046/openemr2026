do $$
begin
  if to_regclass('medication_interaction') is null then
    raise exception 'V38 medication_interaction table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'medication_interaction_immutable'
  ) then
    raise exception 'V38 medication interaction immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'medication_interaction_ingredient_idx'
  ) then
    raise exception 'V38 medication interaction ingredient index missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'medication_interaction_severity_check'
      and contype = 'c'
  ) then
    raise exception 'V38 medication interaction severity constraint missing';
  end if;
end $$;
