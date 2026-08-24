do $$
begin
  if to_regclass('ophthalmology_record') is null then
    raise exception 'V61 ophthalmology_record table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'ophthalmology_record_immutable'
  ) then
    raise exception 'V61 ophthalmology record immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'ophthalmology_record_patient_idx'
  ) then
    raise exception 'V61 ophthalmology record index missing';
  end if;
end $$;
