do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = current_schema() and table_name = 'medication_catalog_version'
      and column_name = 'renal_contraindication_stage'
  ) then
    raise exception 'V67 medication_catalog_version.renal_contraindication_stage column missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = current_schema() and table_name = 'patient'
      and column_name = 'hepatic_impairment_class'
  ) then
    raise exception 'V67 patient.hepatic_impairment_class column missing';
  end if;
end $$;
