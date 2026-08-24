do $$
begin
  if to_regclass('shift_handover') is null then
    raise exception 'V46 shift_handover table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'shift_handover_immutable'
  ) then
    raise exception 'V46 shift handover immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'shift_handover_ward_idx'
  ) then
    raise exception 'V46 shift handover index missing';
  end if;
end $$;
