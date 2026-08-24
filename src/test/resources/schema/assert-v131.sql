do $$
begin
  if to_regclass('source_patient_match_candidate') is null then
    raise exception 'V131 source_patient_match_candidate table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'source_patient_match_candidate_immutable'
  ) then
    raise exception 'V131 patient match candidate immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'source_patient_match_candidate_resolve_check'
  ) then
    raise exception 'V131 patient match candidate resolve constraint missing';
  end if;
end $$;
