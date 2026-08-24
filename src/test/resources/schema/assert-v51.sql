do $$
begin
  if to_regclass('dictionary_item') is null then
    raise exception 'V51 dictionary_item table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'dictionary_item_immutable'
  ) then
    raise exception 'V51 dictionary item immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'dictionary_item_code_idx'
  ) then
    raise exception 'V51 dictionary item index missing';
  end if;
end $$;
