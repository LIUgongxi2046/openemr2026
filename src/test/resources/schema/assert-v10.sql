do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = current_schema() and table_name = 'inpatient_discharge'
  ) then
    raise exception 'V10 inpatient_discharge missing';
  end if;
end $$;
