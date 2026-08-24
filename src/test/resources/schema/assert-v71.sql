do $$
begin
  if to_regclass('imaging_order') is null then
    raise exception 'V71 imaging_order table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'imaging_order_immutable'
  ) then
    raise exception 'V71 imaging order immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'imaging_order_patient_idx'
  ) then
    raise exception 'V71 imaging order index missing';
  end if;
end $$;
