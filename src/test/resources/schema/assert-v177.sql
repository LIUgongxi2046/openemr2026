do $$
declare
  tenant uuid;
  patient uuid;
  encounter_id uuid;
begin
  select scoped.tenant_id, scoped.patient_id, scoped.encounter_id
  into tenant, patient, encounter_id
  from encounter scoped
  order by scoped.tenant_id, scoped.encounter_id
  limit 1;
  if encounter_id is null then
    raise exception 'V177 schema assertion requires a seeded encounter';
  end if;
  if not medical_agent_target_matches_context(tenant, patient, encounter_id, 'ENCOUNTER', encounter_id) then
    raise exception 'V177 must accept the leased encounter as its own target';
  end if;
  if medical_agent_target_matches_context(tenant, patient, encounter_id, 'ENCOUNTER', gen_random_uuid()) then
    raise exception 'V177 must reject an encounter target outside the leased context';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgname = 'medical_agent_run_target_context_guard' and not tgisinternal
  ) then
    raise exception 'V177 must install the medical agent target context trigger';
  end if;

  update medical_agent_release set status = 'INACTIVE'
  where agent_code = 'ENCOUNTER_SUMMARIZER' and release_version = '1.0.0';
  update medical_agent_release set status = 'ACTIVE'
  where agent_code = 'ENCOUNTER_SUMMARIZER' and release_version = '1.0.0';

  begin
    update medical_agent_release set display_name = 'forbidden mutation'
    where agent_code = 'ENCOUNTER_SUMMARIZER' and release_version = '1.0.0';
    raise exception 'V177 release definition mutation should have failed';
  exception when raise_exception then
    if sqlerrm = 'V177 release definition mutation should have failed' then
      raise;
    end if;
  end;
end $$;
