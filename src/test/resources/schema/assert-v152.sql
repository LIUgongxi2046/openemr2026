do $$
begin
  if to_regclass('reproductive_evidence_record') is null then
    raise exception 'V152 reproductive_evidence_record table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'reproductive_note_immutable'
  ) then
    raise exception 'V152 reproductive note immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'reproductive_note_patient_idx'
  ) then
    raise exception 'V152 reproductive note index missing';
  end if;
end $$;
