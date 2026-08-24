do $$
begin
  if to_regclass('lab_specimen') is null then
    raise exception 'V48 lab_specimen table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'lab_specimen_immutable'
  ) then
    raise exception 'V48 lab specimen immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'lab_specimen_encounter_idx'
  ) then
    raise exception 'V48 lab specimen index missing';
  end if;
end $$;
