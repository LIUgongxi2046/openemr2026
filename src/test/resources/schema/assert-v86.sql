do $$
begin
  if to_regclass('nursing_discharge_closure') is null then
    raise exception 'V86 nursing_discharge_closure table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'nursing_discharge_closure_immutable'
  ) then
    raise exception 'V86 nursing discharge closure immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'nursing_discharge_closure_patient_idx'
  ) then
    raise exception 'V86 nursing discharge closure index missing';
  end if;
end $$;
