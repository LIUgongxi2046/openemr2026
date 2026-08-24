do $$
begin
  if to_regclass('dental_evidence_record') is null then
    raise exception 'V157 dental_evidence_record table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'dental_note_immutable'
  ) then
    raise exception 'V157 dental note immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'dental_note_patient_idx'
  ) then
    raise exception 'V157 dental note index missing';
  end if;
end $$;
