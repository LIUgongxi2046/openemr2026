do $$
begin
  if to_regclass('medication_administration') is null then
    raise exception 'V45 medication_administration table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'medication_administration_immutable'
  ) then
    raise exception 'V45 medication administration immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'medication_administration_encounter_idx'
  ) then
    raise exception 'V45 medication administration index missing';
  end if;
end $$;
