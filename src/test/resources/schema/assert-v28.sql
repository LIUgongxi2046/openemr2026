do $$
begin
  if exists (select 1 from pg_trigger where tgname = 'emergency_access_expiry_sweep' and not tgisinternal) then
    raise exception 'V28 silent emergency expiry trigger must be removed';
  end if;
  if exists (
    select 1 from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = current_schema() and procedure.proname = 'expire_emergency_access_grants'
  ) then
    raise exception 'V28 silent emergency expiry function must be removed';
  end if;
end $$;
