do $$
begin
  if to_regclass('dental_qc_review') is null then
    raise exception 'V140 dental_qc_review table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'dental_qc_immutable'
  ) then
    raise exception 'V140 dental QC immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'dental_qc_patient_idx'
  ) then
    raise exception 'V140 dental QC index missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'dental_qc_defect_check'
  ) then
    raise exception 'V140 dental QC defect constraint missing';
  end if;
end $$;
