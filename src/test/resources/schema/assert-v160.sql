do $$
begin
  if to_regclass('neonatal_treatment_record') is null then
    raise exception 'V160 neonatal_treatment_record table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'neonatal_note_immutable'
  ) then
    raise exception 'V160 neonatal note immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'neonatal_note_patient_idx'
  ) then
    raise exception 'V160 neonatal note index missing';
  end if;
end $$;
