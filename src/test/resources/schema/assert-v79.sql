do $$
begin
  if to_regclass('action_approval') is null then
    raise exception 'V79 action_approval table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'action_approval_immutable'
  ) then
    raise exception 'V79 action approval immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'action_approval_patient_idx'
  ) then
    raise exception 'V79 action approval index missing';
  end if;
end $$;
