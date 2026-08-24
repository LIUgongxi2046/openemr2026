do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'appointment' and column_name = 'encounter_id'
  ) then
    raise exception 'V42 appointment encounter_id column missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'appointment_encounter_fk' and contype = 'f'
  ) then
    raise exception 'V42 appointment encounter foreign key missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'appointment_encounter_idx'
  ) then
    raise exception 'V42 appointment encounter index missing';
  end if;
end $$;
