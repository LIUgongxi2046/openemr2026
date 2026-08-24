do $$
begin
  if to_regclass('neonatal_record') is null then
    raise exception 'V59 neonatal_record table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'neonatal_record_immutable'
  ) then
    raise exception 'V59 neonatal record immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'neonatal_record_patient_idx'
  ) then
    raise exception 'V59 neonatal record patient index missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'neonatal_record_mother_idx'
  ) then
    raise exception 'V59 neonatal record mother index missing';
  end if;
end $$;
