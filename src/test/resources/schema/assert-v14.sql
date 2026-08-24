do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = current_schema() and table_name = 'clinical_order'
  ) or not exists (
    select 1 from information_schema.tables
    where table_schema = current_schema() and table_name = 'order_execution_event'
  ) then
    raise exception 'V14 order execution core missing';
  end if;
end $$;
