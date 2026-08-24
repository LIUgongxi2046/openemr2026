do $$
begin
  if to_regclass('dental_record') is null then
    raise exception 'V63 dental_record table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'dental_record_immutable'
  ) then
    raise exception 'V63 dental record immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'dental_record_patient_idx'
  ) then
    raise exception 'V63 dental record index missing';
  end if;
end $$;
