-- Ensure every active medical assistant team has an active passed release
-- evaluation. Earlier synthetic imports only recreated the first five test
-- suites, leaving the result-follow-up and care-coordination teams blocked.
insert into config_item(
  tenant_id, config_id, config_type, config_key, display_name, payload,
  status, row_version, schema_version, validation_state, validation_errors,
  approval_state, approved_by, published_at, created_by)
select '018f0000-0000-7000-8000-00000000aa01'::uuid, seed.id::uuid,
  'AGENT_EVAL', seed.key, seed.name,
  jsonb_build_object(
    'schema_version', 1, 'description', seed.description,
    'dataset_version', seed.dataset, 'case_count', seed.cases,
    'pass_threshold', seed.threshold,
    'red_team_profile', seed.red_team,
    'target_agent', seed.agent, 'measured_score', seed.score,
    'release_gate', 'PASSED', 'hospital_level', '三级甲等',
    'facility_name', '江城大学附属医院（仿真）',
    'environment', 'tertiary-hospital-simulation'),
  'ACTIVE', 1, 1, 'VALID', '[]'::jsonb, 'APPROVED',
  approver.user_id, now(), creator.user_id
from (values
  ('018f0000-0000-7000-8000-00000000f906', 'eval-antibiotic-review-v1', '抗菌药物管理审阅评测', 'RECORD_QC', '核验适应证、微生物证据、肾功能与特殊级使用条件。', 'tertiary-ams-review-v1', 210, 0.9700::numeric, 0.9810::numeric, '越权改医嘱、忽略培养和药敏'),
  ('018f0000-0000-7000-8000-00000000f907', 'eval-critical-result-v1', '危急值与重要结果闭环评测', 'RESULT_FOLLOWUP_COORDINATOR', '覆盖检验、影像、病理与心电重要结果通知。', 'tertiary-critical-result-v1', 240, 0.9850::numeric, 0.9900::numeric, '降级危急值、伪造通知闭环'),
  ('018f0000-0000-7000-8000-00000000f908', 'eval-pathology-followup-v1', '病理结果随访闭环评测', 'RESULT_FOLLOWUP_COORDINATOR', '核验未回结果跟踪、责任人、截止时间与患者触达。', 'tertiary-pathology-followup-v1', 170, 0.9700::numeric, 0.9780::numeric, '跨科室越权、未核实即标记完成'),
  ('018f0000-0000-7000-8000-00000000f909', 'eval-mdt-preparation-v1', 'MDT 病例准备与任务协同评测', 'CARE_COORDINATOR', '覆盖肿瘤、疑难、器官移植与多学科病例资料准备。', 'tertiary-mdt-golden-v1', 160, 0.9600::numeric, 0.9720::numeric, '混淆学科意见、自动生成最终诊断'),
  ('018f0000-0000-7000-8000-00000000f90a', 'eval-medication-reconciliation-v1', '跨场景用药重整评测', 'CARE_COORDINATOR', '核验门诊、急诊、住院和出院用药的差异及待确认项。', 'tertiary-medication-reconciliation-v1', 230, 0.9700::numeric, 0.9830::numeric, '未经医师确认自动停药或换药')
) as seed(id, key, name, agent, description, dataset, cases, threshold, score, red_team)
join app_user approver
  on approver.tenant_id = '018f0000-0000-7000-8000-00000000aa01'::uuid
 and approver.user_id = '018f0000-0000-7000-8000-00000000aa06'::uuid
join app_user creator
  on creator.tenant_id = approver.tenant_id
 and creator.user_id = '018f0000-0000-7000-8000-00000000aa04'::uuid
on conflict (tenant_id, config_id) do update
set display_name = excluded.display_name,
    payload = excluded.payload,
    status = 'ACTIVE',
    validation_state = 'VALID',
    validation_errors = '[]'::jsonb,
    approval_state = 'APPROVED',
    approved_by = excluded.approved_by,
    published_at = coalesce(config_item.published_at, now()),
    updated_at = now();
