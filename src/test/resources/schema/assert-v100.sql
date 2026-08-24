do $$
begin
  if to_regclass('dental_treatment_record') is null then
    raise exception 'V100 dental_treatment_record table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'dental_treatment_immutable'
  ) then
    raise exception 'V100 dental treatment immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'dental_treatment_patient_idx'
  ) then
    raise exception 'V100 dental treatment index missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'dental_treatment_material_batch_check'
  ) then
    raise exception 'V100 dental treatment material-batch constraint missing';
  end if;
end $$;
