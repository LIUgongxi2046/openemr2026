do $$
begin
  if to_regclass('ent_evidence_record') is null then
    raise exception 'V156 ent_evidence_record table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'ent_evidence_immutable'
  ) then
    raise exception 'V156 ent_evidence_record immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'ent_evidence_patient_idx'
  ) then
    raise exception 'V156 ent_evidence_record index missing';
  end if;
end $$;
