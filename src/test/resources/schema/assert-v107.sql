do $$
begin
  if to_regclass('tcm_herbal_prescription') is null then
    raise exception 'V107 tcm_herbal_prescription table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'tcm_prescription_immutable'
  ) then
    raise exception 'V107 TCM prescription immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'tcm_prescription_patient_idx'
  ) then
    raise exception 'V107 TCM prescription index missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'tcm_prescription_toxic_check'
  ) then
    raise exception 'V107 TCM prescription toxic constraint missing';
  end if;
end $$;
