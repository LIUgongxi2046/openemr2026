do $$
begin
  if to_regclass('emergency_nursing_note') is null then
    raise exception 'V89 emergency_nursing_note table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'emergency_nursing_note_immutable'
  ) then
    raise exception 'V89 emergency nursing note immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'emergency_nursing_note_patient_idx'
  ) then
    raise exception 'V89 emergency nursing note index missing';
  end if;
end $$;
