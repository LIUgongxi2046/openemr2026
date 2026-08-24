do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = current_schema() and table_name = 'inpatient_transfer'
  ) then
    raise exception 'V9 inpatient_transfer missing';
  end if;
end $$;
