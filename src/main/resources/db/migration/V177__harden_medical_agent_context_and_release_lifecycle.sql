-- Enforce polymorphic medical-agent targets at the database boundary and allow
-- a release status transition so a newer immutable definition can be activated.

create function medical_agent_target_matches_context(
  p_tenant_id uuid,
  p_patient_id uuid,
  p_encounter_id uuid,
  p_target_type varchar,
  p_target_id uuid
) returns boolean language sql stable as $$
  select case p_target_type
    when 'ENCOUNTER' then p_target_id = p_encounter_id and exists (
      select 1 from encounter
      where tenant_id = p_tenant_id and patient_id = p_patient_id and encounter_id = p_encounter_id)
    when 'DOCUMENT' then exists (
      select 1 from clinical_document
      where tenant_id = p_tenant_id and patient_id = p_patient_id
        and encounter_id = p_encounter_id and document_id = p_target_id)
    when 'RESULT' then exists (
      select 1 from clinical_result
      where tenant_id = p_tenant_id and patient_id = p_patient_id
        and encounter_id = p_encounter_id and result_id = p_target_id)
    when 'TASK' then exists (
      select 1 from clinical_task
      where tenant_id = p_tenant_id and patient_id = p_patient_id
        and encounter_id = p_encounter_id and task_id = p_target_id)
    when 'CARE_PLAN' then exists (
      select 1 from nursing_care_plan
      where tenant_id = p_tenant_id and patient_id = p_patient_id
        and encounter_id = p_encounter_id and care_plan_id = p_target_id)
    else false
  end
$$;

do $$
begin
  if exists (
    select 1 from medical_agent_run
    where not medical_agent_target_matches_context(
      tenant_id, patient_id, encounter_id, target_type, target_id)
  ) then
    raise exception 'existing medical agent run target is outside its patient encounter context';
  end if;
end $$;
create function enforce_medical_agent_run_target_context() returns trigger language plpgsql as $$
begin
  if not medical_agent_target_matches_context(
    new.tenant_id, new.patient_id, new.encounter_id, new.target_type, new.target_id
  ) then
    raise exception 'medical agent run target is outside its patient encounter context'
      using errcode = '23514';
  end if;
  return new;
end $$;

create trigger medical_agent_run_target_context_guard
  before insert or update of tenant_id, patient_id, encounter_id, target_type, target_id
  on medical_agent_run
  for each row execute function enforce_medical_agent_run_target_context();

create or replace function prevent_medical_agent_release_mutation() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'medical agent releases are immutable; publish a new version';
  end if;
  if row(
      new.agent_code, new.release_version, new.display_name, new.agent_level,
      new.parent_agent_code, new.stage_code, new.description, new.display_role,
      new.current_action, new.contribution_label, new.output_schema, new.autonomy_level,
      new.max_steps, new.max_tool_calls, new.max_duration_seconds, new.created_at
    ) is distinct from row(
      old.agent_code, old.release_version, old.display_name, old.agent_level,
      old.parent_agent_code, old.stage_code, old.description, old.display_role,
      old.current_action, old.contribution_label, old.output_schema, old.autonomy_level,
      old.max_steps, old.max_tool_calls, old.max_duration_seconds, old.created_at
    ) then
    raise exception 'medical agent release definitions are immutable; publish a new version';
  end if;
  return new;
end $$;
