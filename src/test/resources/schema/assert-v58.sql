do $$
begin
  if to_regclass('pediatric_record') is null then
    raise exception 'V58 pediatric_record table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'pediatric_record_immutable'
  ) then
    raise exception 'V58 pediatric record immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'pediatric_record_patient_idx'
  ) then
    raise exception 'V58 pediatric record index missing';
  end if;
end $$;
