do $$
begin
  if to_regclass('ophthalmology_care_note') is null then
    raise exception 'V148 ophthalmology_care_note table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'ophthalmology_care_note_immutable'
  ) then
    raise exception 'V148 ophthalmology care note immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'ophthalmology_care_note_patient_idx'
  ) then
    raise exception 'V148 ophthalmology care note index missing';
  end if;
end $$;
