do $$
begin
  if to_regclass('ent_treatment_record') is null then
    raise exception 'V162 ent_treatment_record table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'ent_treatment_immutable'
  ) then
    raise exception 'V162 ent_treatment_record immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'ent_treatment_patient_idx'
  ) then
    raise exception 'V162 ent_treatment_record index missing';
  end if;
end $$;
