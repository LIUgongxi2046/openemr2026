do $$
begin
  if to_regclass('vital_sign_record') is null then
    raise exception 'V43 vital_sign_record table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'vital_sign_record_immutable'
  ) then
    raise exception 'V43 vital sign immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'vital_sign_record_encounter_idx'
  ) then
    raise exception 'V43 vital sign encounter index missing';
  end if;
end $$;
