do $$
begin
  if to_regclass('medication_prescribing_authorization') is null then
    raise exception 'V39 medication_prescribing_authorization table missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'medication_catalog_version'
      and column_name = 'prescribing_restriction_code'
  ) then
    raise exception 'V39 prescribing_restriction_code column missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'medication_prescribing_authorization_immutable'
  ) then
    raise exception 'V39 medication authorization immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'medication_authorization_active_idx'
  ) then
    raise exception 'V39 medication authorization active index missing';
  end if;
end $$;
