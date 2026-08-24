do $$
begin
  if to_regclass('ent_airway_risk_handover') is null then
    raise exception 'V105 ent_airway_risk_handover table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'ent_airway_handover_immutable'
  ) then
    raise exception 'V105 ENT airway handover immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'ent_airway_handover_patient_idx'
  ) then
    raise exception 'V105 ENT airway handover index missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'ent_airway_provider_check'
  ) then
    raise exception 'V105 ENT airway provider constraint missing';
  end if;
end $$;
