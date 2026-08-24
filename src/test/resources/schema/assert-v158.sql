do $$
begin
  if to_regclass('dermatology_evidence_record') is null then
    raise exception 'V158 dermatology_evidence_record table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'dermatology_note_immutable'
  ) then
    raise exception 'V158 dermatology note immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'dermatology_note_patient_idx'
  ) then
    raise exception 'V158 dermatology note index missing';
  end if;
end $$;
