do $$
begin
  if not exists (select 1 from information_schema.tables where table_name = 'clinical_task_delegation') then
    raise exception 'V20 clinical_task_delegation missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'clinical_task_event' and column_name = 'target_user_id'
  ) then
    raise exception 'V20 clinical task target event evidence missing';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'clinical_task_delegation_immutable') then
    raise exception 'V20 clinical task delegation immutability trigger missing';
  end if;
end $$;

