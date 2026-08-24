do $$
begin
  if to_regclass('reproductive_qc_review') is null then
    raise exception 'V134 reproductive_qc_review table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'reproductive_qc_immutable'
  ) then
    raise exception 'V134 reproductive QC immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'reproductive_qc_patient_idx'
  ) then
    raise exception 'V134 reproductive QC index missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'reproductive_qc_defect_check'
  ) then
    raise exception 'V134 reproductive QC defect constraint missing';
  end if;
end $$;
