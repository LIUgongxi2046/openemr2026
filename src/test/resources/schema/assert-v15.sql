do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = current_schema() and table_name = 'order_control_event'
  ) then
    raise exception 'V15 order_control_event missing';
  end if;
end $$;
