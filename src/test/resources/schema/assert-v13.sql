do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = current_schema() and table_name = 'inpatient_clinical_event'
  ) then
    raise exception 'V13 inpatient_clinical_event missing';
  end if;
end $$;
