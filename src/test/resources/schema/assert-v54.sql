do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'research_dataset_request_check1' and contype = 'c'
      and pg_get_constraintdef(oid) like '%EXPORTED%'
      and pg_get_constraintdef(oid) like '%DESTROYED%'
  ) then
    raise exception 'V54 research dataset export check not fixed';
  end if;
end $$;
