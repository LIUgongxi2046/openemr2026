do $$
begin
  if to_regclass('clinical_reminder') is null then
    raise exception 'V56 clinical_reminder table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'clinical_reminder_immutable'
  ) then
    raise exception 'V56 clinical reminder immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'clinical_reminder_encounter_idx'
  ) then
    raise exception 'V56 clinical reminder index missing';
  end if;
end $$;
