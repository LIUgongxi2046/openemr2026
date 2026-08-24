do $$
begin
  if to_regclass('source_field_mapping') is null then
    raise exception 'V130 source_field_mapping table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'source_field_mapping_immutable'
  ) then
    raise exception 'V130 source field mapping immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'source_field_mapping_unique'
  ) then
    raise exception 'V130 source field mapping unique constraint missing';
  end if;
end $$;
