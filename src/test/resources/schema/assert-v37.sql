do $$
begin
  if to_regclass('encounter_state_event') is null then
    raise exception 'V37 encounter_state_event table missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'encounter' and column_name = 'department_id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_name = 'encounter' and column_name = 'responsible_user_id'
  ) then
    raise exception 'V37 encounter department/responsible columns missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'encounter_state_machine_guard'
  ) or not exists (
    select 1 from pg_trigger where tgname = 'encounter_state_event_append'
  ) or not exists (
    select 1 from pg_trigger where tgname = 'encounter_state_event_immutable'
  ) then
    raise exception 'V37 encounter state triggers missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'encounter_status_check'
      and contype = 'c'
  ) or not exists (
    select 1 from pg_constraint where conname = 'encounter_terminal_time_check'
      and contype = 'c'
  ) or not exists (
    select 1 from pg_constraint where conname = 'encounter_department_fk'
      and contype = 'f'
  ) or not exists (
    select 1 from pg_constraint where conname = 'encounter_responsible_user_fk'
      and contype = 'f'
  ) then
    raise exception 'V37 encounter state constraints missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'encounter_state_event_timeline_idx'
  ) then
    raise exception 'V37 encounter state event timeline index missing';
  end if;
end $$;
