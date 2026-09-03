-- 允许 Eva 在未绑定患者/就诊时进行通用问答（查资料、问内容）：
-- 医助运行不再强制要求患者、就诊与诊疗目标。
alter table medical_agent_run alter column patient_id drop not null;
alter table medical_agent_run alter column encounter_id drop not null;
alter table medical_agent_run alter column target_type drop not null;
alter table medical_agent_run alter column target_id drop not null;
