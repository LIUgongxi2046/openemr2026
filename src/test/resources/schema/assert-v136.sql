do $$
begin
  if to_regclass('neonatal_qc_review') is null then
    raise exception 'V136 neonatal_qc_review table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'neonatal_qc_immutable'
  ) then
    raise exception 'V136 neonatal QC immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'neonatal_qc_patient_idx'
  ) then
    raise exception 'V136 neonatal QC index missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'neonatal_qc_defect_check'
  ) then
    raise exception 'V136 neonatal QC defect constraint missing';
  end if;
end $$;
