do $$
begin
  if to_regclass('neonatal_wristband_verification') is null then
    raise exception 'V101 neonatal_wristband_verification table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'neonatal_wristband_immutable'
  ) then
    raise exception 'V101 neonatal wristband verification immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'neonatal_wristband_patient_idx'
  ) then
    raise exception 'V101 neonatal wristband verification index missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'neonatal_wristband_provider_check'
  ) then
    raise exception 'V101 neonatal wristband provider constraint missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'neonatal_wristband_mother_check'
  ) then
    raise exception 'V101 neonatal wristband mother constraint missing';
  end if;
end $$;
