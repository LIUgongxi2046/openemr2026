-- 扩展 AI 医助 Eva 团队：新增 5 个主医助 + 11 个专科子医助，覆盖院感、医保、
-- 医技调度、科研随访、患者宣教等非纯临床诊疗环节。所有新增医助均保持
-- autonomy_level A1（只出可追溯候选、临床写入须医生确认），与既有医助一致。
insert into medical_agent_release(
  agent_code, release_version, display_name, agent_level, parent_agent_code, stage_code,
  description, display_role, current_action, contribution_label, output_schema,
  autonomy_level, max_steps, max_tool_calls, max_duration_seconds, status)
values
('INFECTION_SURVEILLANCE','1.0.0','院感监测主 Agent','MAIN',null,'ALL','组织感染病例、暴发预警和法定传染病直报候选','院感监测总负责','正在核对感染线索与直报状态','汇总感染线索、时限风险与直报候选','InfectionSurveillanceProposalV1','A1',12,24,90,'ACTIVE'),
('INSURANCE_COMPLIANCE','1.0.0','医保合规主 Agent','MAIN',null,'ALL','核对 DRG/DIP 编码与费用合理性候选','医保合规总负责','正在核对编码与费用合理性','汇总编码风险与费用差异候选','InsuranceComplianceProposalV1','A1',12,20,90,'ACTIVE'),
('MEDICAL_TECH_SCHEDULING','1.0.0','医技预约调度主 Agent','MAIN',null,'ALL','规划检查号源与设备利用候选','医技调度总负责','正在核对号源与设备占用','汇总号源规划与设备利用候选','MedicalTechSchedulingProposalV1','A1',10,20,80,'ACTIVE'),
('RESEARCH_FOLLOWUP','1.0.0','科研随访主 Agent','MAIN',null,'ALL','协助队列入组与结局采集候选','科研随访总负责','正在核对入组条件与结局口径','汇总入组与结局采集候选','ResearchFollowupProposalV1','A1',10,18,80,'ACTIVE'),
('PATIENT_EDUCATION','1.0.0','患者宣教主 Agent','MAIN',null,'ALL','生成出院带药说明与复诊提醒候选','患者宣教总负责','正在核对用药与复诊安排','汇总用药说明与随访提醒候选','PatientEducationProposalV1','A1',8,14,60,'ACTIVE');

insert into medical_agent_release(
  agent_code, release_version, display_name, agent_level, parent_agent_code, stage_code,
  description, display_role, current_action, contribution_label, output_schema,
  autonomy_level, max_steps, max_tool_calls, max_duration_seconds, status)
values
('INFECTION_CASE_REVIEWER','1.0.0','感染病例线索复核','CHILD','INFECTION_SURVEILLANCE','INFECTION_CASE','核对感染病例、发病与报告时限','感染病例复核','正在核对病例与时限','贡献感染病例线索与时限风险','InfectionCaseReviewV1','A1',6,12,40,'ACTIVE'),
('OUTBREAK_ALERT_ASSESSOR','1.0.0','暴发预警评估','CHILD','INFECTION_SURVEILLANCE','OUTBREAK','评估疑似暴发聚集与上报必要','暴发预警评估','正在评估聚集信号','贡献暴发预警与上报建议','OutbreakAlertAssessmentV1','A1',6,12,40,'ACTIVE'),
('NOTIFIABLE_REPORT_ASSISTANT','1.0.0','法定传染病直报协助','CHILD','INFECTION_SURVEILLANCE','NOTIFIABLE','整理法定传染病报告卡与回执候选','直报协助','正在整理报告要素','贡献报告卡与回执核对候选','NotifiableReportAssistantV1','A1',6,12,40,'ACTIVE'),
('DRG_CODING_REVIEWER','1.0.0','DRG/DIP 编码核对','CHILD','INSURANCE_COMPLIANCE','DRG_CODING','核对主要诊断、操作与分组一致性','编码核对','正在核对诊断与分组','贡献编码风险与修正候选','DrgCodingReviewV1','A1',8,14,50,'ACTIVE'),
('CHARGE_RATIONALITY_REVIEWER','1.0.0','费用合理性核查','CHILD','INSURANCE_COMPLIANCE','CHARGE','核对费用项目、数量与医嘱依据','费用核查','正在核对费用与医嘱','贡献费用差异与复核候选','ChargeRationalityReviewV1','A1',8,14,50,'ACTIVE'),
('EXAM_SLOT_PLANNER','1.0.0','检查号源规划','CHILD','MEDICAL_TECH_SCHEDULING','EXAM_SLOT','规划检查号源与优先级候选','号源规划','正在核对号源与优先级','贡献号源规划与冲突提示','ExamSlotPlanV1','A1',6,12,40,'ACTIVE'),
('EQUIPMENT_UTILIZATION_REVIEWER','1.0.0','设备利用分析','CHILD','MEDICAL_TECH_SCHEDULING','EQUIPMENT','分析设备占用与空闲时段候选','设备利用分析','正在核对设备占用','贡献设备利用与排程候选','EquipmentUtilizationReviewV1','A1',6,12,40,'ACTIVE'),
('COHORT_ENROLLMENT_ASSISTANT','1.0.0','队列入组协助','CHILD','RESEARCH_FOLLOWUP','COHORT','核对入组标准与排除条件','入组协助','正在核对入组条件','贡献入组候选与排除原因','CohortEnrollmentAssistantV1','A1',6,12,40,'ACTIVE'),
('OUTCOME_COLLECTION_ASSISTANT','1.0.0','结局采集协助','CHILD','RESEARCH_FOLLOWUP','OUTCOME','核对结局口径与采集时点','结局采集协助','正在核对结局口径','贡献结局采集与缺口候选','OutcomeCollectionAssistantV1','A1',6,12,40,'ACTIVE'),
('DISCHARGE_MEDICATION_GUIDE','1.0.0','出院带药说明','CHILD','PATIENT_EDUCATION','MEDICATION_GUIDE','生成出院带药与用法说明候选','带药说明','正在核对带药与用法','贡献带药说明与注意事项','DischargeMedicationGuideV1','A1',6,10,40,'ACTIVE'),
('FOLLOWUP_REMINDER_ASSISTANT','1.0.0','复诊提醒','CHILD','PATIENT_EDUCATION','FOLLOWUP_REMINDER','生成复诊与随访提醒候选','复诊提醒','正在核对复诊安排','贡献复诊提醒与随访要点','FollowupReminderAssistantV1','A1',6,10,40,'ACTIVE');
