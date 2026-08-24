do $$
begin
  if to_regclass('mental_health_qc_review') is null then
    raise exception 'V137 mental_health_qc_review table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'mental_qc_immutable'
  ) then
    raise exception 'V137 mental QC immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'mental_qc_patient_idx'
  ) then
    raise exception 'V137 mental QC index missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'mental_qc_defect_check'
  ) then
    raise exception 'V137 mental QC defect constraint missing';
  end if;
end $$;
