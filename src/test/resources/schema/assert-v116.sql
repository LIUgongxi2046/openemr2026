do $$
begin
  if to_regclass('tcm_four_examinations') is null then
    raise exception 'V116 tcm_four_examinations table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'tcm_four_examinations_immutable'
  ) then
    raise exception 'V116 TCM four examinations immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'tcm_four_examinations_patient_idx'
  ) then
    raise exception 'V116 TCM four examinations index missing';
  end if;
end $$;
