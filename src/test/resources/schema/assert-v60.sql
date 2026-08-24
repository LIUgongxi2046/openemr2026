do $$
begin
  if to_regclass('mental_health_record') is null then
    raise exception 'V60 mental_health_record table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'mental_health_record_immutable'
  ) then
    raise exception 'V60 mental health record immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'mental_health_record_patient_idx'
  ) then
    raise exception 'V60 mental health record index missing';
  end if;
end $$;
