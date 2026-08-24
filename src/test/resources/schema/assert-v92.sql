do $$
begin
  if to_regclass('clinical_task_notification') is null then
    raise exception 'V92 clinical_task_notification table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'clinical_task_notification_immutable'
  ) then
    raise exception 'V92 clinical task notification immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'clinical_task_notification_task_idx'
  ) then
    raise exception 'V92 clinical task notification index missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'clinical_task_notification_check'
  ) then
    raise exception 'V92 clinical task notification delivered-state constraint missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'clinical_task_notification_check1'
  ) then
    raise exception 'V92 clinical task notification failed-state constraint missing';
  end if;
end $$;
