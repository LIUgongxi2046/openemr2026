do $$
begin
  if to_regclass('dermatology_biologic_screening') is null then
    raise exception 'V106 dermatology_biologic_screening table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'dermatology_biologic_immutable'
  ) then
    raise exception 'V106 dermatology biologic immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'dermatology_biologic_patient_idx'
  ) then
    raise exception 'V106 dermatology biologic index missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'dermatology_biologic_cleared_check'
  ) then
    raise exception 'V106 dermatology biologic cleared constraint missing';
  end if;
end $$;
