do $$
begin
  if to_regclass('source_system_inventory') is null then
    raise exception 'V126 source_system_inventory table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'source_system_inventory_immutable'
  ) then
    raise exception 'V126 source system inventory immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'source_system_inventory_source_code_unique'
  ) then
    raise exception 'V126 source system inventory source_code unique constraint missing';
  end if;
end $$;
