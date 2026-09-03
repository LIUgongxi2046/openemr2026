-- 通用问答允许无具体诊疗目标：target_type/target_id 为空时放行，
-- 以便 Eva 在未绑定患者/就诊时回答一般性医学问题（查资料、问内容）。
create or replace function medical_agent_target_matches_context(
  p_tenant_id uuid,
  p_patient_id uuid,
  p_encounter_id uuid,
  p_target_type varchar,
  p_target_id uuid
) returns boolean language sql stable as $$
  select case
    when p_target_type is null then true
    when p_target_type = 'ENCOUNTER' then p_target_id = p_encounter_id and exists (
      select 1 from encounter
      where tenant_id = p_tenant_id and patient_id = p_patient_id and encounter_id = p_encounter_id)
    when p_target_type = 'DOCUMENT' then exists (
      select 1 from clinical_document
      where tenant_id = p_tenant_id and patient_id = p_patient_id
        and encounter_id = p_encounter_id and document_id = p_target_id)
    when p_target_type = 'RESULT' then exists (
      select 1 from clinical_result
      where tenant_id = p_tenant_id and patient_id = p_patient_id
        and encounter_id = p_encounter_id and result_id = p_target_id)
    when p_target_type = 'TASK' then exists (
      select 1 from clinical_task
      where tenant_id = p_tenant_id and patient_id = p_patient_id
        and encounter_id = p_encounter_id and task_id = p_target_id)
    when p_target_type = 'CARE_PLAN' then exists (
      select 1 from nursing_care_plan
      where tenant_id = p_tenant_id and patient_id = p_patient_id
        and encounter_id = p_encounter_id and care_plan_id = p_target_id)
    else false
  end
$$;
