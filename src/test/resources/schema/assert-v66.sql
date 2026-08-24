do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = current_schema() and table_name = 'medication_catalog_version'
      and column_name = 'weight_based'
  ) then
    raise exception 'V66 medication_catalog_version.weight_based column missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = current_schema() and table_name = 'patient'
      and column_name = 'weight_kg'
  ) then
    raise exception 'V66 patient.weight_kg column missing';
  end if;
end $$;
