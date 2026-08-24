do $$
begin
  if to_regclass('encounter_domain_switch') is null then
    raise exception 'V96 encounter_domain_switch table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'encounter_domain_switch_immutable'
  ) then
    raise exception 'V96 encounter domain switch immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'encounter_domain_switch_patient_idx'
  ) then
    raise exception 'V96 encounter domain switch index missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'encounter_domain_switch_domain_check'
  ) then
    raise exception 'V96 encounter domain switch domain constraint missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'encounter_domain_switch_encounter_check'
  ) then
    raise exception 'V96 encounter domain switch encounter constraint missing';
  end if;
end $$;
