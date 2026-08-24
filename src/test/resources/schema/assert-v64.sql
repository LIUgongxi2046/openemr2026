do $$
begin
  if to_regclass('dermatology_record') is null then
    raise exception 'V64 dermatology_record table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'dermatology_record_immutable'
  ) then
    raise exception 'V64 dermatology record immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'dermatology_record_patient_idx'
  ) then
    raise exception 'V64 dermatology record index missing';
  end if;
end $$;
