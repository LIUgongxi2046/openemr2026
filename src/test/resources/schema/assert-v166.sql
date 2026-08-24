do $$
begin
  if to_regclass('config_item_revision') is null then
    raise exception 'V166 config_item_revision table missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = current_schema() and table_name = 'config_item'
      and column_name = 'validation_state'
  ) then
    raise exception 'V166 config_item.validation_state missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'config_item_approval_actor_check'
  ) then
    raise exception 'V166 configuration approval separation constraint missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'config_item_revision_history_idx'
  ) then
    raise exception 'V166 configuration revision history index missing';
  end if;
end $$;
