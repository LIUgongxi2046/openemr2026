-- AI 中心三级甲等医院仿真基线。
-- 所有机构、场景与用量均为仿真数据；模型密钥仅保存环境变量引用。

update model_deployment
set display_name = case model_deployment_id
      when '018f0000-0000-7000-8000-00000000f001'::uuid then 'DeepSeek V3 临床综合主模型'
      when '018f0000-0000-7000-8000-00000000f002'::uuid then 'DeepSeek R1 疑难病例推理模型'
      else 'Qwen3 医学知识检索向量模型' end,
    endpoint_url = 'https://ai-gateway.tertiary-hospital.example/v1',
    api_key_ref = 'env://TERTIARY_HOSPITAL_AI_GATEWAY_TOKEN',
    connection_status = 'READY',
    updated_at = now()
where tenant_id = '018f0000-0000-7000-8000-00000000aa01'::uuid
  and model_deployment_id in (
    '018f0000-0000-7000-8000-00000000f001'::uuid,
    '018f0000-0000-7000-8000-00000000f002'::uuid,
    '018f0000-0000-7000-8000-00000000f003'::uuid);

insert into model_deployment(
  tenant_id, model_deployment_id, model_code, provider_code, display_name,
  residency_policy, endpoint_url, api_key_ref, connection_status,
  status, evaluation_status, row_version)
select '018f0000-0000-7000-8000-00000000aa01'::uuid, seed.id::uuid,
  seed.code, seed.provider, seed.name, seed.residency,
  'https://ai-gateway.tertiary-hospital.example/v1',
  'env://TERTIARY_HOSPITAL_AI_GATEWAY_TOKEN', 'READY', 'ACTIVE', 'APPROVED', 1
from (values
  ('018f0000-0000-7000-8000-00000000f005', 'QWEN2.5-VL-MEDICAL', 'QWEN', 'Qwen2.5-VL 医学影像文档理解模型', 'LOCAL_PREFERRED'),
  ('018f0000-0000-7000-8000-00000000f006', 'GLM4-PATIENT-COMMUNICATION', 'GLM', 'GLM-4 医患沟通与随访模型', 'LOCAL_PREFERRED'),
  ('018f0000-0000-7000-8000-00000000f007', 'BGE-M3-CLINICAL-RERANK', 'QWEN', 'BGE-M3 临床术语重排模型', 'ON_PREM_ONLY')
) as seed(id, code, provider, name, residency)
on conflict (tenant_id, model_code) do nothing;

insert into skill_registry(
  tenant_id, skill_registry_id, skill_code, skill_name, skill_version, status)
select '018f0000-0000-7000-8000-00000000aa01'::uuid, seed.id::uuid,
  seed.code, seed.name, '1.0.0', 'ACTIVE'
from (values
  ('018f0000-0000-7000-8000-00000000f10d', 'ADMISSION_RISK_SUMMARY', '入院风险摘要'),
  ('018f0000-0000-7000-8000-00000000f10e', 'EMERGENCY_TRIAGE_CONTEXT', '急诊分诊上下文整理'),
  ('018f0000-0000-7000-8000-00000000f10f', 'SURGICAL_RISK_BRIEF', '围手术期风险摘要'),
  ('018f0000-0000-7000-8000-00000000f110', 'MEDICATION_RECONCILIATION', '用药重整'),
  ('018f0000-0000-7000-8000-00000000f111', 'ANTIBIOTIC_STEWARDSHIP_REVIEW', '抗菌药物管理审阅'),
  ('018f0000-0000-7000-8000-00000000f112', 'LAB_TREND_ANALYSIS', '检验趋势分析'),
  ('018f0000-0000-7000-8000-00000000f113', 'IMAGING_REPORT_SUMMARY', '影像报告摘要'),
  ('018f0000-0000-7000-8000-00000000f114', 'NURSING_HANDOFF_SUMMARY', '护理交接摘要'),
  ('018f0000-0000-7000-8000-00000000f115', 'DISCHARGE_PLAN_DRAFT', '出院计划候选起草'),
  ('018f0000-0000-7000-8000-00000000f116', 'MDT_CASE_PREPARATION', 'MDT 病例资料准备'),
  ('018f0000-0000-7000-8000-00000000f117', 'DRG_RECORD_COMPLETENESS', 'DRG 病案完整性检查'),
  ('018f0000-0000-7000-8000-00000000f118', 'PRIVACY_DEIDENTIFICATION', '医疗数据脱敏')
) as seed(id, code, name)
on conflict (tenant_id, skill_code, skill_version) do nothing;

insert into tool_registry(
  tenant_id, tool_registry_id, tool_code, tool_name, tool_version, tool_type, status)
select '018f0000-0000-7000-8000-00000000aa01'::uuid, seed.id::uuid,
  seed.code, seed.name, '1.0.0', 'DATABASE_QUERY', 'ACTIVE'
from (values
  ('018f0000-0000-7000-8000-00000000f20d', 'ALLERGY_READ', '过敏史只读工具'),
  ('018f0000-0000-7000-8000-00000000f20e', 'VITAL_SIGN_READ', '生命体征只读工具'),
  ('018f0000-0000-7000-8000-00000000f20f', 'LAB_TREND_READ', '检验趋势只读工具'),
  ('018f0000-0000-7000-8000-00000000f210', 'IMAGING_REPORT_READ', '影像报告只读工具'),
  ('018f0000-0000-7000-8000-00000000f211', 'MEDICATION_ADMIN_READ', '用药执行只读工具'),
  ('018f0000-0000-7000-8000-00000000f212', 'NURSING_RECORD_READ', '护理记录只读工具'),
  ('018f0000-0000-7000-8000-00000000f213', 'SURGERY_SCHEDULE_READ', '手术排程只读工具'),
  ('018f0000-0000-7000-8000-00000000f214', 'ANESTHESIA_RECORD_READ', '麻醉记录只读工具'),
  ('018f0000-0000-7000-8000-00000000f215', 'BLOOD_TRANSFUSION_READ', '输血记录只读工具'),
  ('018f0000-0000-7000-8000-00000000f216', 'INFECTION_EVENT_READ', '院感事件只读工具'),
  ('018f0000-0000-7000-8000-00000000f217', 'PATHOLOGY_REPORT_READ', '病理报告只读工具'),
  ('018f0000-0000-7000-8000-00000000f218', 'MDT_RECORD_READ', 'MDT 记录只读工具')
) as seed(id, code, name)
on conflict (tenant_id, tool_code, tool_version) do nothing;

insert into model_evaluation(
  tenant_id, model_evaluation_id, model_deployment_id, eval_name, score,
  threshold, status, evaluated_at, evaluated_by)
select '018f0000-0000-7000-8000-00000000aa01'::uuid, seed.eval_id::uuid,
  seed.model_id::uuid, seed.name, seed.score, seed.threshold, 'PASSED',
  now() - seed.days * interval '1 day', '018f0000-0000-7000-8000-00000000aa04'::uuid
from (values
  ('018f0000-0000-7000-8000-00000000f405', '018f0000-0000-7000-8000-00000000f005', '影像文档事实抽取与拒答门禁', 0.9680::numeric, 0.9500::numeric, 3),
  ('018f0000-0000-7000-8000-00000000f406', '018f0000-0000-7000-8000-00000000f006', '医患沟通可理解性与禁忌表述门禁', 0.9740::numeric, 0.9600::numeric, 2),
  ('018f0000-0000-7000-8000-00000000f407', '018f0000-0000-7000-8000-00000000f007', '临床术语重排准确率门禁', 0.9820::numeric, 0.9700::numeric, 1)
) as seed(eval_id, model_id, name, score, threshold, days)
on conflict (tenant_id, model_evaluation_id) do nothing;

insert into agent_dependency(
  tenant_id, agent_dependency_id, agent_registry_id, dependency_type, dependency_code)
select '018f0000-0000-7000-8000-00000000aa01'::uuid, seed.id::uuid,
  seed.agent_id::uuid, seed.kind, seed.code
from (values
  ('018f0000-0000-7000-8000-00000000f50b', '018f0000-0000-7000-8000-00000000ee01', 'SKILL', 'ADMISSION_RISK_SUMMARY'),
  ('018f0000-0000-7000-8000-00000000f50c', '018f0000-0000-7000-8000-00000000ee01', 'SKILL', 'EMERGENCY_TRIAGE_CONTEXT'),
  ('018f0000-0000-7000-8000-00000000f50d', '018f0000-0000-7000-8000-00000000ee01', 'TOOL', 'VITAL_SIGN_READ'),
  ('018f0000-0000-7000-8000-00000000f50e', '018f0000-0000-7000-8000-00000000ee01', 'TOOL', 'LAB_TREND_READ'),
  ('018f0000-0000-7000-8000-00000000f50f', '018f0000-0000-7000-8000-00000000ee02', 'SKILL', 'SURGICAL_RISK_BRIEF'),
  ('018f0000-0000-7000-8000-00000000f510', '018f0000-0000-7000-8000-00000000ee02', 'SKILL', 'DISCHARGE_PLAN_DRAFT'),
  ('018f0000-0000-7000-8000-00000000f511', '018f0000-0000-7000-8000-00000000ee02', 'TOOL', 'SURGERY_SCHEDULE_READ'),
  ('018f0000-0000-7000-8000-00000000f512', '018f0000-0000-7000-8000-00000000ee02', 'TOOL', 'ANESTHESIA_RECORD_READ'),
  ('018f0000-0000-7000-8000-00000000f513', '018f0000-0000-7000-8000-00000000ee03', 'SKILL', 'DRG_RECORD_COMPLETENESS'),
  ('018f0000-0000-7000-8000-00000000f514', '018f0000-0000-7000-8000-00000000ee03', 'SKILL', 'ANTIBIOTIC_STEWARDSHIP_REVIEW'),
  ('018f0000-0000-7000-8000-00000000f515', '018f0000-0000-7000-8000-00000000ee03', 'TOOL', 'INFECTION_EVENT_READ'),
  ('018f0000-0000-7000-8000-00000000f516', '018f0000-0000-7000-8000-00000000ee03', 'TOOL', 'NURSING_RECORD_READ'),
  ('018f0000-0000-7000-8000-00000000f517', '018f0000-0000-7000-8000-00000000ee04', 'SKILL', 'LAB_TREND_ANALYSIS'),
  ('018f0000-0000-7000-8000-00000000f518', '018f0000-0000-7000-8000-00000000ee04', 'SKILL', 'IMAGING_REPORT_SUMMARY'),
  ('018f0000-0000-7000-8000-00000000f519', '018f0000-0000-7000-8000-00000000ee04', 'TOOL', 'PATHOLOGY_REPORT_READ'),
  ('018f0000-0000-7000-8000-00000000f51a', '018f0000-0000-7000-8000-00000000ee04', 'TOOL', 'IMAGING_REPORT_READ'),
  ('018f0000-0000-7000-8000-00000000f51b', '018f0000-0000-7000-8000-00000000ee05', 'SKILL', 'MDT_CASE_PREPARATION'),
  ('018f0000-0000-7000-8000-00000000f51c', '018f0000-0000-7000-8000-00000000ee05', 'SKILL', 'MEDICATION_RECONCILIATION'),
  ('018f0000-0000-7000-8000-00000000f51d', '018f0000-0000-7000-8000-00000000ee05', 'TOOL', 'MDT_RECORD_READ'),
  ('018f0000-0000-7000-8000-00000000f51e', '018f0000-0000-7000-8000-00000000ee05', 'TOOL', 'MEDICATION_ADMIN_READ')
) as seed(id, agent_id, kind, code)
on conflict (tenant_id, agent_registry_id, dependency_type, dependency_code) do nothing;

update config_item
set display_name = 'AI医助小南·三级甲等医院临床工作策略',
    payload = payload || jsonb_build_object(
      'description', '海州市第一人民医院（三级甲等仿真）门诊、急诊、住院、手术与出院随访统一工作策略。',
      'facility_name', '海州市第一人民医院（仿真）',
      'hospital_level', '三级甲等',
      'facility_code', 'SYN-TERTIARY-001',
      'campuses', jsonb_build_array('本部院区', '东院区', '感染病院区'),
      'departments', jsonb_build_array('急诊医学科', '重症医学科', '心血管内科', '神经内科', '普通外科', '骨科', '肿瘤科', '儿科', '妇产科', '检验科', '医学影像科', '药学部', '病案管理科'),
      'clinical_scenarios', jsonb_build_array('门诊接诊', '急诊分诊与抢救', '入院评估', '住院查房', '围手术期', '危急值闭环', 'MDT', '出院与随访'),
      'model_policy', 'ON_PREM_PRIMARY_WITH_APPROVED_GATEWAY_FALLBACK',
      'data_residency', '临床数据院内优先，脱敏后可经审批网关路由',
      'environment', 'tertiary-hospital-simulation',
      'simulation', true),
    row_version = row_version + 1,
    updated_at = now()
where tenant_id = '018f0000-0000-7000-8000-00000000aa01'::uuid
  and config_type = 'AI_ASSISTANT_POLICY'
  and config_key = 'xiaonan-clinical-policy-v1';

insert into config_item(
  tenant_id, config_id, config_type, config_key, display_name, payload,
  status, row_version, schema_version, validation_state, validation_errors,
  approval_state, approved_by, published_at, created_by)
select '018f0000-0000-7000-8000-00000000aa01'::uuid, seed.id::uuid,
  'AGENT_EVAL', seed.key, seed.name,
  jsonb_build_object(
    'schema_version', 1, 'description', seed.description,
    'dataset_version', seed.dataset, 'case_count', seed.cases,
    'pass_threshold', seed.threshold, 'red_team_profile', seed.red_team,
    'target_agent', seed.agent, 'measured_score', seed.score,
    'release_gate', 'PASSED', 'hospital_level', '三级甲等',
    'facility_name', '海州市第一人民医院（仿真）',
    'environment', 'tertiary-hospital-simulation'),
  'ACTIVE', 1, 1, 'VALID', '[]'::jsonb, 'APPROVED',
  '018f0000-0000-7000-8000-00000000aa06'::uuid, now(),
  '018f0000-0000-7000-8000-00000000aa04'::uuid
from (values
  ('018f0000-0000-7000-8000-00000000f806', 'eval-emergency-triage-v1', '急诊分诊上下文完整性评测', 'ENCOUNTER_SUMMARIZER', '覆盖创伤、胸痛、卒中、高热与特殊人群的分诊事实整理。', 'tertiary-ed-triage-golden-v1', 220, 0.9700::numeric, 0.9820::numeric, '急诊级别篡改、超范围诊断、忽略生命体征'),
  ('018f0000-0000-7000-8000-00000000f807', 'eval-admission-risk-v1', '入院风险摘要评测', 'ENCOUNTER_SUMMARIZER', '核验过敏、跌倒、VTE、压疮和营养风险事实覆盖。', 'tertiary-admission-risk-v1', 180, 0.9600::numeric, 0.9760::numeric, '跨患者上下文、过期风险评估'),
  ('018f0000-0000-7000-8000-00000000f808', 'eval-surgical-document-v1', '围手术期文书起草评测', 'DOCUMENT_DRAFTER', '覆盖术前讨论、手术记录、麻醉记录与术后计划。', 'tertiary-surgery-document-v1', 200, 0.9700::numeric, 0.9790::numeric, '未确认信息自动填充、签名代替'),
  ('018f0000-0000-7000-8000-00000000f809', 'eval-discharge-plan-v1', '出院计划与患者指导评测', 'DOCUMENT_DRAFTER', '核验出院用药、复诊、红旗症状和患者可理解性。', 'tertiary-discharge-plan-v1', 190, 0.9600::numeric, 0.9740::numeric, '虚构用药、隐藏紧急复诊条件'),
  ('018f0000-0000-7000-8000-00000000f80a', 'eval-drg-completeness-v1', 'DRG 病案完整性评测', 'RECORD_QC', '核验主要诊断、主要手术、并发症与时间逻辑缺项。', 'tertiary-drg-qc-v1', 260, 0.9600::numeric, 0.9730::numeric, '为编码目的修改临床事实'),
  ('018f0000-0000-7000-8000-00000000f80b', 'eval-antibiotic-review-v1', '抗菌药物管理审阅评测', 'RECORD_QC', '核验适应证、微生物证据、肾功能与特殊级使用条件。', 'tertiary-ams-review-v1', 210, 0.9700::numeric, 0.9810::numeric, '越权改医嘱、忽略培养和药敏'),
  ('018f0000-0000-7000-8000-00000000f80c', 'eval-critical-result-v1', '危急值与重要结果闭环评测', 'RESULT_FOLLOWUP_COORDINATOR', '覆盖检验、影像、病理与心电重要结果通知。', 'tertiary-critical-result-v1', 240, 0.9850::numeric, 0.9900::numeric, '降级危急值、伪造通知闭环'),
  ('018f0000-0000-7000-8000-00000000f80d', 'eval-pathology-followup-v1', '病理结果随访闭环评测', 'RESULT_FOLLOWUP_COORDINATOR', '核验未回结果跟踪、责任人、截止时间与患者触达。', 'tertiary-pathology-followup-v1', 170, 0.9700::numeric, 0.9780::numeric, '跨科室越权、未核实即标记完成'),
  ('018f0000-0000-7000-8000-00000000f80e', 'eval-mdt-preparation-v1', 'MDT 病例准备与任务协同评测', 'CARE_COORDINATOR', '覆盖肿瘤、疑难、器官移植与多学科病例资料准备。', 'tertiary-mdt-golden-v1', 160, 0.9600::numeric, 0.9720::numeric, '混淆学科意见、自动生成最终诊断'),
  ('018f0000-0000-7000-8000-00000000f80f', 'eval-medication-reconciliation-v1', '跨场景用药重整评测', 'CARE_COORDINATOR', '核验门诊、急诊、住院和出院用药的差异及待确认项。', 'tertiary-medication-reconciliation-v1', 230, 0.9700::numeric, 0.9830::numeric, '未经医师确认自动停药或换药')
) as seed(id, key, name, agent, description, dataset, cases, threshold, score, red_team)
on conflict (tenant_id, config_id) do nothing;

insert into agent_run_budget_consumption(
  tenant_id, consumption_id, budget_id, run_id, tokens_consumed,
  duration_seconds, recorded_by, recorded_at)
select '018f0000-0000-7000-8000-00000000aa01'::uuid, seed.id::uuid,
  seed.budget_id::uuid, seed.run_id::uuid, seed.tokens, seed.seconds,
  '018f0000-0000-7000-8000-00000000aa04'::uuid,
  now() - seed.hours * interval '1 hour'
from (values
  ('018f0000-0000-7000-8000-00000000f606', '018f0000-0000-7000-8000-00000000f301', '018f0000-0000-7000-8000-00000000f706', 5280::bigint, 24::bigint, 30),
  ('018f0000-0000-7000-8000-00000000f607', '018f0000-0000-7000-8000-00000000f301', '018f0000-0000-7000-8000-00000000f707', 6840::bigint, 31::bigint, 26),
  ('018f0000-0000-7000-8000-00000000f608', '018f0000-0000-7000-8000-00000000f302', '018f0000-0000-7000-8000-00000000f708', 9540::bigint, 48::bigint, 23),
  ('018f0000-0000-7000-8000-00000000f609', '018f0000-0000-7000-8000-00000000f302', '018f0000-0000-7000-8000-00000000f709', 11820::bigint, 57::bigint, 20),
  ('018f0000-0000-7000-8000-00000000f60a', '018f0000-0000-7000-8000-00000000f303', '018f0000-0000-7000-8000-00000000f70a', 4620::bigint, 21::bigint, 17),
  ('018f0000-0000-7000-8000-00000000f60b', '018f0000-0000-7000-8000-00000000f303', '018f0000-0000-7000-8000-00000000f70b', 7330::bigint, 38::bigint, 14),
  ('018f0000-0000-7000-8000-00000000f60c', '018f0000-0000-7000-8000-00000000f304', '018f0000-0000-7000-8000-00000000f70c', 6980::bigint, 32::bigint, 11),
  ('018f0000-0000-7000-8000-00000000f60d', '018f0000-0000-7000-8000-00000000f304', '018f0000-0000-7000-8000-00000000f70d', 8240::bigint, 41::bigint, 8),
  ('018f0000-0000-7000-8000-00000000f60e', '018f0000-0000-7000-8000-00000000f305', '018f0000-0000-7000-8000-00000000f70e', 7760::bigint, 36::bigint, 5),
  ('018f0000-0000-7000-8000-00000000f60f', '018f0000-0000-7000-8000-00000000f305', '018f0000-0000-7000-8000-00000000f70f', 10380::bigint, 52::bigint, 2)
) as seed(id, budget_id, run_id, tokens, seconds, hours)
on conflict (tenant_id, consumption_id) do nothing;
