do $$
begin
  if to_regclass('ent_qc_review') is null then
    raise exception 'V139 ent_qc_review table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'ent_qc_immutable'
  ) then
    raise exception 'V139 ent QC immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'ent_qc_patient_idx'
  ) then
    raise exception 'V139 ent QC index missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'ent_qc_defect_check'
  ) then
    raise exception 'V139 ent QC defect constraint missing';
  end if;
end $$;
