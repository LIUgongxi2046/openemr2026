do $$
begin
  if to_regclass('ophthalmology_preop_verification') is null then
    raise exception 'V104 ophthalmology_preop_verification table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'ophthalmology_preop_immutable'
  ) then
    raise exception 'V104 ophthalmology preop immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'ophthalmology_preop_patient_idx'
  ) then
    raise exception 'V104 ophthalmology preop index missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'ophthalmology_preop_provider_check'
  ) then
    raise exception 'V104 ophthalmology preop provider constraint missing';
  end if;
end $$;
