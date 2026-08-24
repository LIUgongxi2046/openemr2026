do $$
begin
  if to_regclass('shift_handover_patient') is null then
    raise exception 'V69 shift_handover_patient table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'shift_handover_patient_immutable'
  ) then
    raise exception 'V69 shift handover patient immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'shift_handover_patient_handover_idx'
  ) then
    raise exception 'V69 shift handover patient index missing';
  end if;
end $$;
