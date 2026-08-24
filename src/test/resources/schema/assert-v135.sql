do $$
begin
  if to_regclass('pediatric_qc_review') is null then
    raise exception 'V135 pediatric_qc_review table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'pediatric_qc_immutable'
  ) then
    raise exception 'V135 pediatrics QC immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'pediatric_qc_patient_idx'
  ) then
    raise exception 'V135 pediatrics QC index missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'pediatric_qc_defect_check'
  ) then
    raise exception 'V135 pediatrics QC defect constraint missing';
  end if;
end $$;
