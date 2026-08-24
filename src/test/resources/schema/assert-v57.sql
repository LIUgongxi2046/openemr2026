do $$
begin
  if to_regclass('art_cycle_record') is null then
    raise exception 'V57 art_cycle_record table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'art_cycle_record_immutable'
  ) then
    raise exception 'V57 art cycle immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'art_cycle_patient_idx'
  ) then
    raise exception 'V57 art cycle index missing';
  end if;
end $$;
