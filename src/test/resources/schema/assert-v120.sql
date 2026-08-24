do $$
begin
  if to_regclass('ophthalmology_postop_followup') is null then
    raise exception 'V120 ophthalmology_postop_followup table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'ophthalmology_postop_immutable'
  ) then
    raise exception 'V120 ophthalmology postop immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'ophthalmology_postop_patient_idx'
  ) then
    raise exception 'V120 ophthalmology postop index missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'ophthalmology_postop_iop_complication_check'
  ) then
    raise exception 'V120 ophthalmology postop iop complication constraint missing';
  end if;
end $$;
