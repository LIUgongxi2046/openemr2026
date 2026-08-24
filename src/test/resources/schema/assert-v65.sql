do $$
begin
  if to_regclass('tcm_record') is null then
    raise exception 'V65 tcm_record table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'tcm_record_immutable'
  ) then
    raise exception 'V65 TCM record immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'tcm_record_patient_idx'
  ) then
    raise exception 'V65 TCM record index missing';
  end if;
end $$;
