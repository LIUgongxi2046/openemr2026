do $$
begin
  if not exists (select 1 from information_schema.tables where table_name = 'clinical_task') then
    raise exception 'V19 clinical_task missing';
  end if;
  if not exists (select 1 from information_schema.tables where table_name = 'clinical_task_event') then
    raise exception 'V19 clinical_task_event missing';
  end if;
  if not exists (select 1 from pg_indexes where indexname = 'clinical_task_encounter_state_idx') then
    raise exception 'V19 clinical task encounter index missing';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'clinical_task_event_immutable') then
    raise exception 'V19 clinical task event immutability trigger missing';
  end if;
end $$;

