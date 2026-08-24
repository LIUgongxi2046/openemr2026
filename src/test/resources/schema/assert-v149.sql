do $$
begin
  if to_regclass('dental_care_note') is null then
    raise exception 'V149 dental_care_note table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'dental_care_note_immutable'
  ) then
    raise exception 'V149 dental care note immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'dental_care_note_patient_idx'
  ) then
    raise exception 'V149 dental care note index missing';
  end if;
end $$;
