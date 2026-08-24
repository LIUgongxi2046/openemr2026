do $$
begin
  if to_regclass('blood_transfusion') is null then
    raise exception 'V50 blood_transfusion table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'blood_transfusion_immutable'
  ) then
    raise exception 'V50 blood transfusion immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'blood_transfusion_encounter_idx'
  ) then
    raise exception 'V50 blood transfusion index missing';
  end if;
end $$;
