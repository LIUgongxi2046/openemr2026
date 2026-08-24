do $$
begin
  if to_regclass('obstetric_qc_review') is null then
    raise exception 'V112 obstetric_qc_review table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'obstetric_qc_immutable'
  ) then
    raise exception 'V112 obstetric QC immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'obstetric_qc_patient_idx'
  ) then
    raise exception 'V112 obstetric QC index missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'obstetric_qc_defect_check'
  ) then
    raise exception 'V112 obstetric QC defect constraint missing';
  end if;
end $$;
