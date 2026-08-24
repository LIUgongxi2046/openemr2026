do $$
begin
  if to_regclass('price_catalog_version') is null or to_regclass('charge_item') is null then
    raise exception 'V47 price catalog or charge item table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'charge_item_immutable'
  ) then
    raise exception 'V47 charge item immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'price_catalog_active_idx'
  ) or not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'charge_item_encounter_idx'
  ) then
    raise exception 'V47 price/charge indexes missing';
  end if;
end $$;
