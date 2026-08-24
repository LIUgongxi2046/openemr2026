do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = current_schema() and table_name = 'inpatient_document_task'
      and column_name = 'working_document_id'
  ) then
    raise exception 'V8 working_document_id missing';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = current_schema()
      and indexname = 'inpatient_document_task_working_document_idx'
  ) then
    raise exception 'V8 unique working document index missing';
  end if;
end $$;
