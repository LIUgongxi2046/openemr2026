-- 为 V343 新增的 5 个主医助与 11 个专科子医助补齐问题示例，
-- 让对话界面医助团队的「建议提问」与受控编排路由保持一致。
insert into medical_agent_question_example(agent_code, release_version, example_order, question_text)
values
('INFECTION_SURVEILLANCE','1.0.0',1,'请整理当前病区的院感线索、隔离措施和待核实病例，按风险排序。'),
('INFECTION_SURVEILLANCE','1.0.0',2,'请核对近期感染病例之间的时间、病区和操作关联，判断是否存在聚集倾向。'),
('INSURANCE_COMPLIANCE','1.0.0',1,'请核对当前病历的 DRG/DIP 主要诊断与编码依据是否一致。'),
('INSURANCE_COMPLIANCE','1.0.0',2,'请检查本次诊疗的费用项目和医嘱是否符合医保报销与自费告知要求。'),
('MEDICAL_TECH_SCHEDULING','1.0.0',1,'请根据待检查项目和设备占用情况规划可用的检查号源。'),
('MEDICAL_TECH_SCHEDULING','1.0.0',2,'请找出需要优先安排或存在设备冲突的检查，并给出排程建议。'),
('RESEARCH_FOLLOWUP','1.0.0',1,'请核对当前患者是否符合研究队列的入组与排除条件。'),
('RESEARCH_FOLLOWUP','1.0.0',2,'请整理该随访节点的结局指标采集口径和仍需补齐的数据。'),
('PATIENT_EDUCATION','1.0.0',1,'请为出院患者生成用药说明、复诊时间和异常情况的就医提醒。'),
('PATIENT_EDUCATION','1.0.0',2,'请把本次诊疗需要患者配合的事项整理成通俗易懂的宣教要点。'),
('INFECTION_CASE_REVIEWER','1.0.0',1,'请核对这例院内感染病例的感染时间、部位和侵入性操作线索。'),
('OUTBREAK_ALERT_ASSESSOR','1.0.0',1,'请评估近期病例是否构成聚集或暴发，并给出预警级别建议。'),
('NOTIFIABLE_REPORT_ASSISTANT','1.0.0',1,'请核对这例需上报的传染病是否符合直报时限和要素要求。'),
('DRG_CODING_REVIEWER','1.0.0',1,'请检查主要诊断与手术操作编码是否匹配，并标出依据不足处。'),
('CHARGE_RATIONALITY_REVIEWER','1.0.0',1,'请比对医嘱与收费项目，找出重复计费或与诊疗不符的条目。'),
('EXAM_SLOT_PLANNER','1.0.0',1,'请根据申请项目、号源和设备状态给出可行的检查预约时段。'),
('EQUIPMENT_UTILIZATION_REVIEWER','1.0.0',1,'请分析设备占用与维护窗口，找出可用时段和冲突风险。'),
('COHORT_ENROLLMENT_ASSISTANT','1.0.0',1,'请对照入排标准核查该患者是否可入组，并列出待确认条件。'),
('OUTCOME_COLLECTION_ASSISTANT','1.0.0',1,'请按研究方案口径整理该随访节点的结局与不良事件信息。'),
('DISCHARGE_MEDICATION_GUIDE','1.0.0',1,'请生成出院带药的用法用量、注意事项和漏服处理说明。'),
('FOLLOWUP_REMINDER_ASSISTANT','1.0.0',1,'请根据复诊与随访计划生成提醒内容，并标出异常升级条件。');
