do $$
begin
  if to_regclass('tcm_qc_review') is null then
    raise exception 'V133 tcm_qc_review table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'tcm_qc_immutable'
  ) then
    raise exception 'V133 tcm QC immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'tcm_qc_patient_idx'
  ) then
    raise exception 'V133 tcm QC index missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'tcm_qc_defect_check'
  ) then
    raise exception 'V133 tcm QC defect constraint missing';
  end if;
end $$;
