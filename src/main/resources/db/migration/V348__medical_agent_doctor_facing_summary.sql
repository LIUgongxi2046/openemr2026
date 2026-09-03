-- 为每个主医助增加一句面向医生的能力简介（30 字左右），
-- 用于对话区顶部展示「能帮医生做什么」。
alter table medical_agent_release add column doctor_facing_summary varchar(200);

update medical_agent_release set doctor_facing_summary = case agent_code
  when 'ENCOUNTER_SUMMARIZER' then '帮你按诊疗阶段梳理就诊事实、变化与待确认问题'
  when 'DOCUMENT_DRAFTER' then '帮你起草病历、病程、出院小结等文书草稿'
  when 'RECORD_QC' then '帮你复核病历完整性、前后矛盾与质量缺项'
  when 'RESULT_FOLLOWUP_COORDINATOR' then '帮你跟踪检查检验结果、危急值与复查闭环'
  when 'CARE_COORDINATOR' then '帮你准备会诊、转科、出院与随访协同事项'
  when 'INFECTION_SURVEILLANCE' then '帮你发现院感线索、聚集暴发与直报风险'
  when 'INSURANCE_COMPLIANCE' then '帮你核对 DRG/DIP 编码与费用合理性'
  when 'MEDICAL_TECH_SCHEDULING' then '帮你规划检查号源与设备利用'
  when 'RESEARCH_FOLLOWUP' then '帮你核对队列入组与结局采集'
  when 'PATIENT_EDUCATION' then '帮你生成带药说明与复诊提醒'
end
where agent_level = 'MAIN';
