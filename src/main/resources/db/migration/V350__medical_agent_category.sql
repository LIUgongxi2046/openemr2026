-- 为医助团队增加分类，便于前端按分类分组展示。
-- 分类：CLINICAL 临床诊疗 / SPECIALTY 专科医助 / GOVERNANCE 治理与运营 / CARE 随访与宣教
alter table medical_agent_release add column category varchar(32);

update medical_agent_release set category = case agent_code
  when 'ENCOUNTER_SUMMARIZER' then 'CLINICAL'
  when 'DOCUMENT_DRAFTER' then 'CLINICAL'
  when 'RECORD_QC' then 'CLINICAL'
  when 'RESULT_FOLLOWUP_COORDINATOR' then 'CLINICAL'
  when 'CARE_COORDINATOR' then 'CLINICAL'
  when 'GLYCEMIC_MANAGEMENT' then 'SPECIALTY'
  when 'CARDIOVASCULAR_CARE' then 'SPECIALTY'
  when 'TCM_SYNDROME_REVIEW' then 'SPECIALTY'
  when 'ICU_RISK_ASSESSMENT' then 'SPECIALTY'
  when 'INFECTION_SURVEILLANCE' then 'GOVERNANCE'
  when 'INSURANCE_COMPLIANCE' then 'GOVERNANCE'
  when 'MEDICAL_TECH_SCHEDULING' then 'GOVERNANCE'
  when 'RESEARCH_FOLLOWUP' then 'CARE'
  when 'PATIENT_EDUCATION' then 'CARE'
end
where agent_level = 'MAIN';
