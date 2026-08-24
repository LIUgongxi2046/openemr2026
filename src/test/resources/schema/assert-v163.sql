do $$
begin
  if to_regclass('config_item') is null then
    raise exception 'V163 config_item table missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'config_item_status_check'
  ) then
    raise exception 'V163 config_item status check missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'config_item_type_idx'
  ) then
    raise exception 'V163 config_item type index missing';
  end if;
end $$;
