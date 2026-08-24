do $$
begin
  if to_regclass('neonatal_screening_record') is null then
    raise exception 'V117 neonatal_screening_record table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'neonatal_screening_immutable'
  ) then
    raise exception 'V117 neonatal screening immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'neonatal_screening_patient_idx'
  ) then
    raise exception 'V117 neonatal screening index missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'neonatal_screening_refer_check'
  ) then
    raise exception 'V117 neonatal screening refer constraint missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'neonatal_screening_mother_check'
  ) then
    raise exception 'V117 neonatal screening mother constraint missing';
  end if;
end $$;
