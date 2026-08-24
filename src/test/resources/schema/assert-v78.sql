do $$
begin
  if to_regclass('dictation_note') is null then
    raise exception 'V78 dictation_note table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'dictation_note_immutable'
  ) then
    raise exception 'V78 dictation note immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'dictation_note_patient_idx'
  ) then
    raise exception 'V78 dictation note index missing';
  end if;
end $$;
