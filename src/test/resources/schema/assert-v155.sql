do $$
begin
  if to_regclass('ophthalmology_evidence_record') is null then
    raise exception 'V155 ophthalmology_evidence_record table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'ophthalmology_note_immutable'
  ) then
    raise exception 'V155 ophthalmology note immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'ophthalmology_note_patient_idx'
  ) then
    raise exception 'V155 ophthalmology note index missing';
  end if;
end $$;
