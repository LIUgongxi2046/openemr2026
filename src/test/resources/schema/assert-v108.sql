do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = current_schema() and table_name = 'clinical_task' and column_name = 'ward_id'
  ) then
    raise exception 'V108 clinical_task.ward_id column missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'clinical_task_ward_fk'
  ) then
    raise exception 'V108 clinical task ward foreign key missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'clinical_task_ward_idx'
  ) then
    raise exception 'V108 clinical task ward index missing';
  end if;
end $$;
