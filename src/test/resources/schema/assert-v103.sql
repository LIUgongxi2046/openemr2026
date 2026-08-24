do $$
begin
  if to_regclass('pediatric_growth_record') is null then
    raise exception 'V103 pediatric_growth_record table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'pediatric_growth_immutable'
  ) then
    raise exception 'V103 pediatric growth immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'pediatric_growth_patient_idx'
  ) then
    raise exception 'V103 pediatric growth index missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'pediatric_growth_height_check'
  ) then
    raise exception 'V103 pediatric growth height constraint missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'pediatric_growth_weight_check'
  ) then
    raise exception 'V103 pediatric growth weight constraint missing';
  end if;
end $$;
