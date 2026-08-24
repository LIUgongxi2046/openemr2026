do $$
begin
  if to_regclass('art_pregnancy_outcome') is null then
    raise exception 'V114 art_pregnancy_outcome table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'art_outcome_immutable'
  ) then
    raise exception 'V114 ART pregnancy outcome immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'art_outcome_patient_idx'
  ) then
    raise exception 'V114 ART pregnancy outcome index missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'art_outcome_miscarriage_check'
  ) then
    raise exception 'V114 ART pregnancy outcome miscarriage constraint missing';
  end if;
end $$;
