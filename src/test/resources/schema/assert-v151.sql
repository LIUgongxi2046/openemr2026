do $$
begin
  if to_regclass('tcm_care_note') is null then
    raise exception 'V151 tcm_care_note table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'tcm_care_note_immutable'
  ) then
    raise exception 'V151 tcm care note immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'tcm_care_note_patient_idx'
  ) then
    raise exception 'V151 tcm care note index missing';
  end if;
end $$;
