do $$
begin
  if to_regclass('obstetric_record') is null then
    raise exception 'V55 obstetric_record table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'obstetric_record_immutable'
  ) then
    raise exception 'V55 obstetric record immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'obstetric_record_patient_idx'
  ) then
    raise exception 'V55 obstetric record index missing';
  end if;
end $$;
