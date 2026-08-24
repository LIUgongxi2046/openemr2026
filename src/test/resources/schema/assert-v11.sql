do $$
begin
  if (select count(*) from inpatient_document_rule where status = 'ACTIVE') < 15 then
    raise exception 'V11 inpatient document catalog incomplete';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = current_schema() and table_name = 'inpatient_document_task'
      and column_name = 'occurrence_key'
  ) then
    raise exception 'V11 occurrence_key missing';
  end if;
end $$;
