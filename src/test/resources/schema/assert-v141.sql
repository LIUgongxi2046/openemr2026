do $$
begin
  if to_regclass('dermatology_qc_review') is null then
    raise exception 'V141 dermatology_qc_review table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'dermatology_qc_immutable'
  ) then
    raise exception 'V141 dermatology QC immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'dermatology_qc_patient_idx'
  ) then
    raise exception 'V141 dermatology QC index missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'dermatology_qc_defect_check'
  ) then
    raise exception 'V141 dermatology QC defect constraint missing';
  end if;
end $$;
