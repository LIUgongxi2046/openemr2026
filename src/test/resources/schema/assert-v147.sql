do $$
begin
  if to_regclass('reproductive_care_note') is null then
    raise exception 'V147 reproductive_care_note table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'reproductive_care_note_immutable'
  ) then
    raise exception 'V147 reproductive care note immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'reproductive_care_note_patient_idx'
  ) then
    raise exception 'V147 reproductive care note index missing';
  end if;
end $$;
