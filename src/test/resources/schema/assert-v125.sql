do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'clinical_task_notification' and column_name = 'scheduled_at'
  ) then
    raise exception 'V125 clinical_task_notification scheduled_at column missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'clinical_task_notification_dispatch_idx'
  ) then
    raise exception 'V125 clinical task notification dispatch index missing';
  end if;
end $$;
