-- 扩充 4 个专科医助团队：血糖/胰岛素治理（内分泌）、心血管诊疗协理（心内）、
-- 中医辨证审方（中医）、重症风险研判（重症）。所有新增医助保持 autonomy A1
-- （只出可追溯候选、临床写入须医生确认），与既有医助一致。
insert into medical_agent_release(
  agent_code, release_version, display_name, agent_level, parent_agent_code, stage_code,
  description, doctor_facing_summary, display_role, current_action, contribution_label, output_schema,
  autonomy_level, max_steps, max_tool_calls, max_duration_seconds, status)
values
('GLYCEMIC_MANAGEMENT','1.0.0','血糖治理主 Agent','MAIN',null,'ALL','生成住院血糖与胰岛素剂量调整候选','帮你管理住院血糖、调整胰岛素与防低血糖','血糖治理总负责','正在核对血糖、用药与低血糖风险','汇总血糖趋势、剂量候选与低血糖风险','GlycemicManagementProposalV1','A1',12,24,90,'ACTIVE'),
('CARDIOVASCULAR_CARE','1.0.0','心血管诊疗主 Agent','MAIN',null,'ALL','生成胸痛、心衰与房颤的专科决策候选','帮你做心血管风险分层、抗凝用药与随访','心血管诊疗协理','正在核对心血管风险与用药','汇总风险分层、用药候选与随访计划','CardiovascularCareProposalV1','A1',12,24,90,'ACTIVE'),
('TCM_SYNDROME_REVIEW','1.0.0','中医辨证审方主 Agent','MAIN',null,'ALL','生成辨证、方药思路与配伍禁忌候选','帮你辨证、出方药思路并查配伍禁忌','中医辨证审方','正在核对四诊、方药与配伍禁忌','汇总辨证、方药候选与配伍风险','TcmSyndromeReviewProposalV1','A1',12,20,90,'ACTIVE'),
('ICU_RISK_ASSESSMENT','1.0.0','重症风险研判主 Agent','MAIN',null,'ALL','生成脓毒症与病情恶化风险分层候选','帮你研判脓毒症与恶化风险并整理交班','重症风险研判','正在核对监护、检验与恶化风险','汇总风险分层、处置清单与交班摘要','IcuRiskAssessmentProposalV1','A1',12,24,90,'ACTIVE');

insert into medical_agent_release(
  agent_code, release_version, display_name, agent_level, parent_agent_code, stage_code,
  description, display_role, current_action, contribution_label, output_schema,
  autonomy_level, max_steps, max_tool_calls, max_duration_seconds, status)
values
('ADMISSION_GLUCOSE_ASSESSOR','1.0.0','入院血糖评估','CHILD','GLYCEMIC_MANAGEMENT','ADMISSION_GLUCOSE','核对入院血糖、糖化与降糖用药','入院血糖评估','正在核对入院血糖与用药','贡献入院血糖基线候选','AdmissionGlucoseAssessmentV1','A1',6,12,40,'ACTIVE'),
('INSULIN_DOSE_ADVISOR','1.0.0','胰岛素剂量建议','CHILD','GLYCEMIC_MANAGEMENT','INSULIN_DOSING','生成胰岛素剂量调整候选与低血糖风险','胰岛素剂量建议','正在核对剂量与低血糖风险','贡献剂量调整候选','InsulinDoseAdvisorV1','A1',8,14,50,'ACTIVE'),
('HYPOGLYCEMIA_GUARD','1.0.0','低血糖预警','CHILD','GLYCEMIC_MANAGEMENT','HYPOGLYCEMIA','核对低血糖风险、诱因与处置候选','低血糖预警','正在核对低血糖风险','贡献低血糖风险与处置候选','HypoglycemiaGuardV1','A1',6,12,40,'ACTIVE'),
('DISCHARGE_GLUCOSE_PLAN','1.0.0','出院血糖随访','CHILD','GLYCEMIC_MANAGEMENT','DISCHARGE_GLUCOSE','生成出院降糖方案与随访提醒候选','出院血糖随访','正在核对出院方案与随访','贡献出院降糖方案候选','DischargeGlucosePlanV1','A1',6,10,40,'ACTIVE'),
('CHEST_PAIN_TRIAGE','1.0.0','胸痛风险分层','CHILD','CARDIOVASCULAR_CARE','CHEST_PAIN','核对胸痛风险分层与检查候选','胸痛风险分层','正在核对胸痛风险与检查','贡献胸痛分层候选','ChestPainTriageV1','A1',8,14,50,'ACTIVE'),
('ANTICOAGULATION_ADVISOR','1.0.0','抗凝用药建议','CHILD','CARDIOVASCULAR_CARE','ANTICOAGULATION','核对房颤卒中风险与抗凝候选','抗凝用药建议','正在核对卒中与出血风险','贡献抗凝方案候选','AnticoagulationAdvisorV1','A1',8,14,50,'ACTIVE'),
('HEART_FAILURE_FOLLOWUP','1.0.0','心衰随访计划','CHILD','CARDIOVASCULAR_CARE','HEART_FAILURE','核对心衰指标与随访计划候选','心衰随访计划','正在核对心衰指标与随访','贡献心衰随访候选','HeartFailureFollowupV1','A1',6,12,40,'ACTIVE'),
('SYNDROME_DIFFERENTIATION','1.0.0','辨证草稿','CHILD','TCM_SYNDROME_REVIEW','SYNDROME','核对四诊与辨证分型候选','辨证草稿','正在核对四诊与辨证','贡献辨证分型候选','SyndromeDifferentiationV1','A1',8,14,50,'ACTIVE'),
('HERBAL_FORMULA_ADVISOR','1.0.0','方药思路','CHILD','TCM_SYNDROME_REVIEW','HERBAL_FORMULA','生成方药思路候选','方药思路','正在核对方药与加减','贡献方药思路候选','HerbalFormulaAdvisorV1','A1',8,14,50,'ACTIVE'),
('HERB_INTERACTION_GUARD','1.0.0','配伍禁忌','CHILD','TCM_SYNDROME_REVIEW','HERB_SAFETY','核对十八反十九畏与中西药相互作用','配伍禁忌','正在核对配伍与相互作用','贡献配伍风险候选','HerbInteractionGuardV1','A1',6,12,40,'ACTIVE'),
('DECOCTION_GUIDE','1.0.0','煎服指导','CHILD','TCM_SYNDROME_REVIEW','DECOCTION','生成煎服方法与注意事项候选','煎服指导','正在核对煎服与用法','贡献煎服指导候选','DecoctionGuideV1','A1',6,10,40,'ACTIVE'),
('SEPSIS_RISK_ASSESSOR','1.0.0','脓毒症风险分层','CHILD','ICU_RISK_ASSESSMENT','SEPSIS_RISK','核对脓毒症筛查与风险分层候选','脓毒症风险分层','正在核对脓毒症筛查与分层','贡献脓毒症风险候选','SepsisRiskAssessorV1','A1',8,14,50,'ACTIVE'),
('DETERIORATION_MONITOR','1.0.0','病情恶化预警','CHILD','ICU_RISK_ASSESSMENT','DETERIORATION','核对生命体征与恶化趋势','病情恶化预警','正在核对生命体征趋势','贡献恶化风险候选','DeteriorationMonitorV1','A1',6,12,40,'ACTIVE'),
('ICU_HANDOFF_SUMMARIZER','1.0.0','重症交班摘要','CHILD','ICU_RISK_ASSESSMENT','ICU_HANDOFF','生成重症交班摘要草稿','重症交班摘要','正在核对交班要素','贡献交班摘要候选','IcuHandoffSummarizerV1','A1',6,12,40,'ACTIVE');

insert into medical_agent_question_example(agent_code, release_version, example_order, question_text)
values
('GLYCEMIC_MANAGEMENT','1.0.0',1,'请核对当前患者的住院血糖趋势、降糖用药与低血糖风险。'),
('GLYCEMIC_MANAGEMENT','1.0.0',2,'请给出下一步胰岛素剂量调整建议，并标出低血糖诱因。'),
('CARDIOVASCULAR_CARE','1.0.0',1,'请对这位胸痛患者做心血管风险分层并给出检查建议。'),
('CARDIOVASCULAR_CARE','1.0.0',2,'请核对这位房颤患者的卒中与出血风险，给出抗凝建议。'),
('TCM_SYNDROME_REVIEW','1.0.0',1,'请根据四诊信息给出辨证分型与方药思路草稿。'),
('TCM_SYNDROME_REVIEW','1.0.0',2,'请核对拟方是否存在十八反十九畏或中西药相互作用。'),
('ICU_RISK_ASSESSMENT','1.0.0',1,'请评估这位危重患者的脓毒症与病情恶化风险。'),
('ICU_RISK_ASSESSMENT','1.0.0',2,'请整理这位患者的重症交班摘要草稿。'),
('ADMISSION_GLUCOSE_ASSESSOR','1.0.0',1,'请核对入院血糖、糖化血红蛋白和现有降糖用药。'),
('INSULIN_DOSE_ADVISOR','1.0.0',1,'请根据近期血糖趋势给出胰岛素剂量调整草稿。'),
('HYPOGLYCEMIA_GUARD','1.0.0',1,'请找出低血糖风险诱因并给出处置草稿。'),
('DISCHARGE_GLUCOSE_PLAN','1.0.0',1,'请生成出院降糖方案与随访提醒草稿。'),
('CHEST_PAIN_TRIAGE','1.0.0',1,'请核对胸痛危险因素并给出风险分层与检查建议。'),
('ANTICOAGULATION_ADVISOR','1.0.0',1,'请核对房颤卒中风险并给出抗凝方案草稿。'),
('HEART_FAILURE_FOLLOWUP','1.0.0',1,'请核对心衰指标并给出随访计划草稿。'),
('SYNDROME_DIFFERENTIATION','1.0.0',1,'请根据四诊信息给出辨证分型草稿。'),
('HERBAL_FORMULA_ADVISOR','1.0.0',1,'请给出方药思路与加减草稿。'),
('HERB_INTERACTION_GUARD','1.0.0',1,'请核对配伍禁忌与中西药相互作用。'),
('DECOCTION_GUIDE','1.0.0',1,'请生成煎服方法与注意事项草稿。'),
('SEPSIS_RISK_ASSESSOR','1.0.0',1,'请核对脓毒症筛查指标并给出风险分层。'),
('DETERIORATION_MONITOR','1.0.0',1,'请核对生命体征趋势并评估恶化风险。'),
('ICU_HANDOFF_SUMMARIZER','1.0.0',1,'请生成重症交班摘要草稿。');

insert into medical_agent_composition_release(
  composition_code, release_version, root_agent_code, max_depth, status)
values
('GLYCEMIC_MANAGEMENT_DEFAULT','1.0.0','GLYCEMIC_MANAGEMENT',1,'ACTIVE'),
('CARDIOVASCULAR_CARE_DEFAULT','1.0.0','CARDIOVASCULAR_CARE',1,'ACTIVE'),
('TCM_SYNDROME_REVIEW_DEFAULT','1.0.0','TCM_SYNDROME_REVIEW',1,'ACTIVE'),
('ICU_RISK_ASSESSMENT_DEFAULT','1.0.0','ICU_RISK_ASSESSMENT',1,'ACTIVE');

insert into medical_agent_composition_node(
  composition_code, release_version, child_agent_code, stage_code, node_order, critical, parallel_group)
values
('GLYCEMIC_MANAGEMENT_DEFAULT','1.0.0','ADMISSION_GLUCOSE_ASSESSOR','ADMISSION_GLUCOSE',1,false,'STAGE'),
('GLYCEMIC_MANAGEMENT_DEFAULT','1.0.0','INSULIN_DOSE_ADVISOR','INSULIN_DOSING',2,true,'STAGE'),
('GLYCEMIC_MANAGEMENT_DEFAULT','1.0.0','HYPOGLYCEMIA_GUARD','HYPOGLYCEMIA',3,true,'STAGE'),
('GLYCEMIC_MANAGEMENT_DEFAULT','1.0.0','DISCHARGE_GLUCOSE_PLAN','DISCHARGE_GLUCOSE',4,false,'STAGE'),
('CARDIOVASCULAR_CARE_DEFAULT','1.0.0','CHEST_PAIN_TRIAGE','CHEST_PAIN',1,true,'STAGE'),
('CARDIOVASCULAR_CARE_DEFAULT','1.0.0','ANTICOAGULATION_ADVISOR','ANTICOAGULATION',2,false,'STAGE'),
('CARDIOVASCULAR_CARE_DEFAULT','1.0.0','HEART_FAILURE_FOLLOWUP','HEART_FAILURE',3,false,'STAGE'),
('TCM_SYNDROME_REVIEW_DEFAULT','1.0.0','SYNDROME_DIFFERENTIATION','SYNDROME',1,false,'STAGE'),
('TCM_SYNDROME_REVIEW_DEFAULT','1.0.0','HERBAL_FORMULA_ADVISOR','HERBAL_FORMULA',2,false,'STAGE'),
('TCM_SYNDROME_REVIEW_DEFAULT','1.0.0','HERB_INTERACTION_GUARD','HERB_SAFETY',3,true,'STAGE'),
('TCM_SYNDROME_REVIEW_DEFAULT','1.0.0','DECOCTION_GUIDE','DECOCTION',4,false,'STAGE'),
('ICU_RISK_ASSESSMENT_DEFAULT','1.0.0','SEPSIS_RISK_ASSESSOR','SEPSIS_RISK',1,true,'STAGE'),
('ICU_RISK_ASSESSMENT_DEFAULT','1.0.0','DETERIORATION_MONITOR','DETERIORATION',2,true,'STAGE'),
('ICU_RISK_ASSESSMENT_DEFAULT','1.0.0','ICU_HANDOFF_SUMMARIZER','ICU_HANDOFF',3,false,'STAGE');
