do $$
begin
  if to_regclass('ophthalmology_qc_review') is null then
    raise exception 'V138 ophthalmology_qc_review table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'ophthalmology_qc_immutable'
  ) then
    raise exception 'V138 ophthalmology QC immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'ophthalmology_qc_patient_idx'
  ) then
    raise exception 'V138 ophthalmology QC index missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'ophthalmology_qc_defect_check'
  ) then
    raise exception 'V138 ophthalmology QC defect constraint missing';
  end if;
end $$;
