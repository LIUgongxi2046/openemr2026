create table inpatient_document_rule (
  tenant_id uuid not null,
  rule_code varchar(128) not null,
  document_type_code varchar(128) not null,
  display_name varchar(256) not null,
  category_code varchar(32) not null
    check (category_code in ('ADMISSION', 'COURSE', 'ROUND', 'CONSULTATION', 'PERIOPERATIVE', 'EVENT', 'TERMINAL')),
  trigger_type varchar(24) not null
    check (trigger_type in ('ADMISSION', 'DAILY', 'EVENT', 'DISCHARGE', 'MANUAL')),
  due_minutes integer not null check (due_minutes >= 0),
  required_signature_level varchar(32) not null
    check (required_signature_level in ('AUTHOR', 'ATTENDING', 'CHIEF', 'MEDICAL_RECORDS')),
  template_sections jsonb not null check (jsonb_typeof(template_sections) = 'array'),
  status varchar(24) not null check (status in ('DRAFT', 'ACTIVE', 'RETIRED')),
  rule_version bigint not null default 1 check (rule_version > 0),
  effective_from timestamptz not null default now(),
  effective_until timestamptz,
  primary key (tenant_id, rule_code),
  unique (tenant_id, document_type_code),
  foreign key (tenant_id) references tenant(tenant_id),
  check (effective_until is null or effective_until > effective_from)
);

alter table inpatient_document_task
  drop constraint inpatient_document_task_tenant_id_admission_id_document_typ_key;

alter table inpatient_document_task
  add column occurrence_key varchar(128),
  add column rule_version bigint,
  add column source_event_id uuid;

update inpatient_document_task
set occurrence_key = 'BASE', rule_version = 1
where occurrence_key is null;

alter table inpatient_document_task
  alter column occurrence_key set not null,
  alter column rule_version set not null,
  add constraint inpatient_document_task_occurrence_key
    unique (tenant_id, admission_id, document_type_code, occurrence_key);

insert into inpatient_document_rule(
  tenant_id, rule_code, document_type_code, display_name, category_code, trigger_type,
  due_minutes, required_signature_level, template_sections, status)
select tenant_id, seed.rule_code, seed.document_type_code, seed.display_name, seed.category_code,
  seed.trigger_type, seed.due_minutes, seed.signature_level, seed.sections::jsonb, 'ACTIVE'
from tenant
cross join (values
  ('IP-ADMISSION', 'WS445.5.ADMISSION_RECORD', '入院记录', 'ADMISSION', 'ADMISSION', 1440, 'ATTENDING', '["chief_complaint","present_illness","past_history","personal_history","marital_history","family_history","physical_examination","specialty_examination","diagnostic_basis","differential_diagnosis","assessment","treatment_plan","communication"]'),
  ('IP-FIRST-COURSE', 'WS445.5.FIRST_COURSE_RECORD', '首次病程记录', 'COURSE', 'ADMISSION', 480, 'ATTENDING', '["case_features","provisional_diagnosis","diagnostic_basis","differential_diagnosis","risk_assessment","treatment_plan","communication"]'),
  ('IP-ATTENDING-ROUND', 'WS445.5.ATTENDING_REVIEW', '主治医师首次查房记录', 'ROUND', 'ADMISSION', 2880, 'ATTENDING', '["round_time","participants","history_supplement","examination_findings","diagnostic_analysis","treatment_adjustment","attending_opinion"]'),
  ('IP-DAILY-COURSE', 'WS445.5.DAILY_COURSE_RECORD', '日常病程记录', 'COURSE', 'DAILY', 1440, 'AUTHOR', '["event_time","condition_change","examination_findings","result_analysis","treatment_response","assessment","treatment_plan","communication"]'),
  ('IP-CHIEF-ROUND', 'WS445.5.CHIEF_REVIEW', '主任医师查房记录', 'ROUND', 'MANUAL', 1440, 'CHIEF', '["round_time","participants","case_summary","diagnostic_analysis","differential_diagnosis","treatment_guidance","chief_opinion"]'),
  ('IP-STAGE-SUMMARY', 'WS445.5.STAGE_SUMMARY', '阶段小结', 'COURSE', 'MANUAL', 1440, 'ATTENDING', '["period","admission_summary","diagnosis_evolution","treatment_course","current_condition","next_plan"]'),
  ('IP-CONSULTATION', 'WS445.5.CONSULTATION_RECORD', '会诊记录', 'CONSULTATION', 'EVENT', 1440, 'ATTENDING', '["request_time","consultation_time","reason","consultant","consultation_opinion","disposition"]'),
  ('IP-TRANSFER', 'WS445.5.TRANSFER_RECORD', '转科记录', 'EVENT', 'EVENT', 360, 'ATTENDING', '["transfer_time","from_department","to_department","condition_before_transfer","diagnosis","treatment_course","transfer_reason","handover_plan"]'),
  ('IP-PREOPERATIVE', 'WS445.5.PREOPERATIVE_SUMMARY', '术前小结', 'PERIOPERATIVE', 'EVENT', 720, 'ATTENDING', '["preoperative_diagnosis","surgical_indication","operation_plan","risk_assessment","preparation","consent"]'),
  ('IP-OPERATION', 'WS445.5.OPERATION_RECORD', '手术记录', 'PERIOPERATIVE', 'EVENT', 1440, 'ATTENDING', '["operation_time","preoperative_diagnosis","postoperative_diagnosis","operation_name","surgeon","anesthesia","procedure","findings","specimen","complications"]'),
  ('IP-RESCUE', 'WS445.5.RESCUE_RECORD', '抢救记录', 'EVENT', 'EVENT', 360, 'ATTENDING', '["event_time","recorded_time","condition","participants","measures","medications","response","outcome","late_entry_reason"]'),
  ('IP-TRANSFUSION', 'WS445.5.TRANSFUSION_RECORD', '输血记录', 'EVENT', 'EVENT', 360, 'ATTENDING', '["indication","consent","blood_component","verification","start_time","end_time","monitoring","reaction","outcome"]'),
  ('IP-CRITICAL', 'WS445.5.CRITICAL_ILLNESS_RECORD', '病危病重记录', 'EVENT', 'EVENT', 360, 'ATTENDING', '["event_time","severity","clinical_basis","treatment","communication","family_acknowledgement"]'),
  ('IP-DISCHARGE', 'WS445.5.DISCHARGE_RECORD', '出院记录', 'TERMINAL', 'DISCHARGE', 1440, 'ATTENDING', '["admission_diagnosis","discharge_diagnosis","admission_condition","treatment_course","discharge_condition","discharge_medication","follow_up","education"]'),
  ('IP-DEATH', 'WS445.5.DEATH_RECORD', '死亡记录', 'TERMINAL', 'EVENT', 1440, 'CHIEF', '["death_time","admission_condition","treatment_course","rescue_process","cause_of_death","death_diagnosis","family_communication"]')
) as seed(rule_code, document_type_code, display_name, category_code, trigger_type,
  due_minutes, signature_level, sections);

create index inpatient_document_rule_active_idx
  on inpatient_document_rule (tenant_id, trigger_type, category_code)
  where status = 'ACTIVE';
