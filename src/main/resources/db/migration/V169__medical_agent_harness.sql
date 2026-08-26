create table medical_agent_release (
  agent_code varchar(128) not null,
  release_version varchar(64) not null,
  display_name varchar(128) not null,
  agent_level varchar(16) not null check (agent_level in ('MAIN', 'CHILD')),
  parent_agent_code varchar(128),
  stage_code varchar(64) not null,
  description varchar(512) not null,
  display_role varchar(128) not null,
  current_action varchar(256) not null,
  contribution_label varchar(256) not null,
  output_schema varchar(128) not null,
  autonomy_level varchar(8) not null check (autonomy_level in ('A0', 'A1', 'A2')),
  max_steps integer not null check (max_steps > 0),
  max_tool_calls integer not null check (max_tool_calls > 0),
  max_duration_seconds integer not null check (max_duration_seconds > 0),
  status varchar(16) not null check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  primary key (agent_code, release_version),
  foreign key (parent_agent_code, release_version)
    references medical_agent_release(agent_code, release_version),
  check ((agent_level = 'MAIN' and parent_agent_code is null)
    or (agent_level = 'CHILD' and parent_agent_code is not null))
);

create unique index medical_agent_release_active_idx
  on medical_agent_release(agent_code) where status = 'ACTIVE';
create index medical_agent_release_family_idx
  on medical_agent_release(parent_agent_code, stage_code, agent_code);

create function prevent_medical_agent_release_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'medical agent releases are immutable; publish a new version';
end $$;

create trigger medical_agent_release_immutable
  before update or delete on medical_agent_release
  for each row execute function prevent_medical_agent_release_mutation();

create table medical_agent_composition_release (
  composition_code varchar(128) not null,
  release_version varchar(64) not null,
  root_agent_code varchar(128) not null,
  max_depth integer not null default 1 check (max_depth = 1),
  status varchar(16) not null check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  primary key (composition_code, release_version),
  foreign key (root_agent_code, release_version)
    references medical_agent_release(agent_code, release_version)
);

create unique index medical_agent_composition_active_idx
  on medical_agent_composition_release(composition_code) where status = 'ACTIVE';

create table medical_agent_composition_node (
  composition_code varchar(128) not null,
  release_version varchar(64) not null,
  child_agent_code varchar(128) not null,
  stage_code varchar(64) not null,
  node_order integer not null check (node_order > 0),
  critical boolean not null default false,
  parallel_group varchar(64) not null,
  primary key (composition_code, release_version, child_agent_code),
  unique (composition_code, release_version, node_order),
  foreign key (composition_code, release_version)
    references medical_agent_composition_release(composition_code, release_version),
  foreign key (child_agent_code, release_version)
    references medical_agent_release(agent_code, release_version)
);

create table medical_agent_run (
  tenant_id uuid not null,
  run_id uuid not null,
  context_lease_id uuid not null,
  root_agent_code varchar(128) not null,
  root_agent_version varchar(64) not null,
  composition_code varchar(128) not null,
  composition_version varchar(64) not null,
  requested_stage varchar(64) not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  target_type varchar(64) not null,
  target_id uuid not null,
  objective varchar(1024) not null,
  state varchar(24) not null check (state in (
    'QUEUED', 'RUNNING', 'WAITING_FOR_REVIEW', 'COMPLETED', 'PARTIAL',
    'BLOCKED', 'FAILED', 'CANCELLED')),
  sequence bigint not null default 0 check (sequence >= 0),
  output_payload jsonb not null default '{}'::jsonb,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  row_version bigint not null default 1 check (row_version > 0),
  primary key (tenant_id, run_id),
  foreign key (tenant_id, context_lease_id) references context_lease(tenant_id, lease_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, created_by) references app_user(tenant_id, user_id),
  foreign key (root_agent_code, root_agent_version)
    references medical_agent_release(agent_code, release_version),
  foreign key (composition_code, composition_version)
    references medical_agent_composition_release(composition_code, release_version),
  check (length(trim(objective)) between 2 and 1024)
);

create index medical_agent_run_tenant_state_idx
  on medical_agent_run(tenant_id, state, created_at desc);
create index medical_agent_run_encounter_idx
  on medical_agent_run(tenant_id, encounter_id, created_at desc);

create table medical_agent_child_run (
  tenant_id uuid not null,
  child_run_id uuid not null,
  root_run_id uuid not null,
  child_agent_code varchar(128) not null,
  child_agent_version varchar(64) not null,
  state varchar(24) not null check (state in (
    'QUEUED', 'RUNNING', 'COMPLETED', 'PARTIAL', 'BLOCKED', 'FAILED', 'CANCELLED', 'SKIPPED')),
  critical boolean not null,
  contribution jsonb not null default '{}'::jsonb,
  source_references jsonb not null default '[]'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  primary key (tenant_id, child_run_id),
  unique (tenant_id, root_run_id, child_agent_code),
  foreign key (tenant_id, root_run_id) references medical_agent_run(tenant_id, run_id),
  foreign key (child_agent_code, child_agent_version)
    references medical_agent_release(agent_code, release_version)
);

create index medical_agent_child_run_root_idx
  on medical_agent_child_run(tenant_id, root_run_id, child_run_id);

create table medical_agent_run_event (
  tenant_id uuid not null,
  run_id uuid not null,
  sequence bigint not null check (sequence > 0),
  event_id uuid not null,
  event_type varchar(96) not null,
  child_run_id uuid,
  payload jsonb not null,
  occurred_at timestamptz not null default now(),
  primary key (tenant_id, run_id, sequence),
  unique (tenant_id, event_id),
  foreign key (tenant_id, run_id) references medical_agent_run(tenant_id, run_id),
  foreign key (tenant_id, child_run_id) references medical_agent_child_run(tenant_id, child_run_id)
);

insert into medical_agent_release(
  agent_code, release_version, display_name, agent_level, parent_agent_code, stage_code,
  description, display_role, current_action, contribution_label, output_schema,
  autonomy_level, max_steps, max_tool_calls, max_duration_seconds, status)
values
('ENCOUNTER_SUMMARIZER','1.0.0','就诊摘要主 Agent','MAIN',null,'ALL','按诊疗阶段组织带来源的事实摘要','就诊事实总协调','正在选择当前诊疗环节的摘要协作者','汇总阶段事实、变化、缺口与来源','EncounterSummaryProposalV1','A1',12,24,90,'ACTIVE'),
('DOCUMENT_DRAFTER','1.0.0','文书起草主 Agent','MAIN',null,'ALL','为明确文书任务生成可审阅候选','文书候选总负责','正在校验文书任务、模板与作者身份','汇总逐段草稿、来源、缺口与差异','ClinicalDocumentDraftProposalV1','A1',14,24,120,'ACTIVE'),
('RECORD_QC','1.0.0','病历质控主 Agent','MAIN',null,'ALL','在硬规则之后提供语义质控第二视角','语义质控总负责','正在识别病历生命周期阶段','汇总硬规则与 AI 语义发现','RecordQcProposalV1','A1',10,20,90,'ACTIVE'),
('RESULT_FOLLOWUP_COORDINATOR','1.0.0','结果闭环主 Agent','MAIN',null,'ALL','组织结果趋势、危急值上下文和闭环候选','结果闭环总负责','正在核对结果和责任状态','汇总结果状态、风险来源和任务候选','ResultFollowupProposalV1','A1',14,28,120,'ACTIVE'),
('CARE_COORDINATOR','1.0.0','诊疗协同主 Agent','MAIN',null,'ALL','准备会诊、交接、出院和随访协同候选','诊疗协同总负责','正在核对目标团队和责任范围','汇总协同事实、未决问题和计划候选','CareCoordinationProposalV1','A1',14,24,120,'ACTIVE');

insert into medical_agent_release(
  agent_code, release_version, display_name, agent_level, parent_agent_code, stage_code,
  description, display_role, current_action, contribution_label, output_schema,
  autonomy_level, max_steps, max_tool_calls, max_duration_seconds, status)
values
('PRE_VISIT_SUMMARIZER','1.0.0','诊前摘要协作者','CHILD','ENCOUNTER_SUMMARIZER','PRE_VISIT','汇总既往问题、过敏、用药、结果和开放任务','诊前资料整理','正在核对既往资料与开放任务','贡献诊前事实包和待确认问题','PreVisitSummaryV1','A1',6,12,35,'ACTIVE'),
('TRIAGE_CONTEXT_SUMMARIZER','1.0.0','分诊上下文协作者','CHILD','ENCOUNTER_SUMMARIZER','TRIAGE','汇总主诉、生命体征和分诊事实','分诊事实整理','正在核对分诊事实和规则状态','贡献分诊上下文和冲突提示','TriageContextV1','A1',5,10,25,'ACTIVE'),
('ACTIVE_ENCOUNTER_SUMMARIZER','1.0.0','接诊摘要协作者','CHILD','ENCOUNTER_SUMMARIZER','ACTIVE_ENCOUNTER','汇总当次录入、变化和待确认问题','当次就诊整理','正在整理本次接诊新变化','贡献当次事实、变化和缺口','ActiveEncounterSummaryV1','A1',6,12,35,'ACTIVE'),
('INPATIENT_DAILY_SUMMARIZER','1.0.0','住院每日摘要协作者','CHILD','ENCOUNTER_SUMMARIZER','INPATIENT_DAILY','按时窗汇总住院事件、结果和任务','住院每日事实整理','正在核对指定时窗内的住院事实','贡献每日事实、变化和未闭环项','InpatientDailySummaryV1','A1',7,16,45,'ACTIVE'),
('PERIOPERATIVE_CONTEXT_SUMMARIZER','1.0.0','围术期上下文协作者','CHILD','ENCOUNTER_SUMMARIZER','PERIOPERATIVE','形成围术期事实包和缺项','围术期事实整理','正在核对部位、侧别和核查来源','贡献围术期事实和安全缺口','PerioperativeContextV1','A1',7,14,45,'ACTIVE'),
('DISCHARGE_READINESS_SUMMARIZER','1.0.0','出院准备摘要协作者','CHILD','ENCOUNTER_SUMMARIZER','DISCHARGE','列出出院准备事实和未闭环责任','出院准备核对','正在核对未决结果、任务和用药','贡献准备状态和未闭环责任','DischargeReadinessSummaryV1','A1',7,16,45,'ACTIVE'),
('OUTPATIENT_NOTE_DRAFTER','1.0.0','门诊病历起草协作者','CHILD','DOCUMENT_DRAFTER','OUTPATIENT','草拟门诊病历候选','门诊文书起草','正在按模板组织已确认门诊事实','贡献门诊病历分节草稿','OutpatientNoteDraftV1','A1',6,10,40,'ACTIVE'),
('EMERGENCY_NOTE_DRAFTER','1.0.0','急诊记录起草协作者','CHILD','DOCUMENT_DRAFTER','EMERGENCY','草拟急诊记录和时间线缺口','急诊文书起草','正在核对急诊时间关键事件','贡献急诊记录草稿和时间线缺口','EmergencyNoteDraftV1','A1',7,14,50,'ACTIVE'),
('ADMISSION_NOTE_DRAFTER','1.0.0','入院记录起草协作者','CHILD','DOCUMENT_DRAFTER','ADMISSION','草拟入院记录候选','入院文书起草','正在核对入院史和查体来源','贡献入院记录草稿和必填缺口','AdmissionNoteDraftV1','A1',7,12,50,'ACTIVE'),
('FIRST_COURSE_DRAFTER','1.0.0','首次病程起草协作者','CHILD','DOCUMENT_DRAFTER','FIRST_COURSE','草拟首次病程候选','首程文书起草','正在区分事实、依据、鉴别和计划','贡献首次病程分层草稿','FirstCourseDraftV1','A1',7,12,50,'ACTIVE'),
('PROGRESS_NOTE_DRAFTER','1.0.0','病程记录起草协作者','CHILD','DOCUMENT_DRAFTER','PROGRESS','草拟日常或阶段病程','病程文书起草','正在核对时窗内计划与执行','贡献病程草稿和状态差异','ProgressNoteDraftV1','A1',7,14,50,'ACTIVE'),
('WARD_ROUND_NOTE_DRAFTER','1.0.0','查房记录起草协作者','CHILD','DOCUMENT_DRAFTER','WARD_ROUND','草拟主治或主任查房记录','查房文书起草','正在核对查房者实际输入和来源','贡献查房记录草稿和未确认项','WardRoundNoteDraftV1','A1',7,12,50,'ACTIVE'),
('CONSULT_NOTE_DRAFTER','1.0.0','会诊文书起草协作者','CHILD','DOCUMENT_DRAFTER','CONSULT','草拟会诊申请或基于实际输入草拟意见','会诊文书起草','正在校验申请方和会诊方角色','贡献会诊文书草稿和角色提示','ConsultNoteDraftV1','A1',6,10,45,'ACTIVE'),
('PERIOPERATIVE_NOTE_DRAFTER','1.0.0','围术期文书起草协作者','CHILD','DOCUMENT_DRAFTER','PERIOPERATIVE','草拟指定围术期文书','围术期文书起草','正在核对手术、器械和人员来源','贡献围术期草稿和高风险缺口','PerioperativeNoteDraftV1','A1',8,16,60,'ACTIVE'),
('NURSING_HANDOFF_DRAFTER','1.0.0','护理交班起草协作者','CHILD','DOCUMENT_DRAFTER','NURSING_HANDOFF','草拟班次或转单元护理交班','护理交班起草','正在核对班次、MAR 和未完成任务','贡献护理交班草稿和未完成项','NursingHandoffDraftV1','A1',7,14,50,'ACTIVE'),
('DISCHARGE_NOTE_DRAFTER','1.0.0','出院文书起草协作者','CHILD','DOCUMENT_DRAFTER','DISCHARGE','草拟出院小结或终末文书','出院文书起草','正在核对住院经过和未决事项','贡献出院文书草稿和未决结果','DischargeNoteDraftV1','A1',8,16,60,'ACTIVE'),
('WRITING_QC_REVIEWER','1.0.0','书写中质控协作者','CHILD','RECORD_QC','WRITING','提供低打扰结构和一致性提示','书写中语义质控','正在检查结构、来源和一致性','贡献非阻断书写提示','WritingQcFindingsV1','A1',5,8,25,'ACTIVE'),
('PRE_SIGN_QC_REVIEWER','1.0.0','签署前质控协作者','CHILD','RECORD_QC','PRE_SIGN','检查签署前完整性、一致性和时序','签署前语义质控','正在核对不可变版本和硬规则','贡献签署前语义发现','PreSignQcFindingsV1','A1',6,10,35,'ACTIVE'),
('ACTIVE_RECORD_QC_REVIEWER','1.0.0','运行病历质控协作者','CHILD','RECORD_QC','ACTIVE_RECORD','抽查逾期、复制和诊疗一致性','运行病历质控','正在核对在院病历和责任任务','贡献运行病历缺陷候选','ActiveRecordQcFindingsV1','A1',7,14,45,'ACTIVE'),
('TERMINAL_RECORD_QC_REVIEWER','1.0.0','终末质控协作者','CHILD','RECORD_QC','TERMINAL_RECORD','检查归档前文书、编码和闭环','终末病历质控','正在核对归档硬门和整改闭环','贡献终末质控缺口清单','TerminalRecordQcFindingsV1','A1',8,16,55,'ACTIVE'),
('CORRECTION_CONSISTENCY_REVIEWER','1.0.0','更正一致性协作者','CHILD','RECORD_QC','CORRECTION','分析更正前后版本和引用影响','更正影响分析','正在构建更正版本影响图','贡献受影响对象和复核候选','CorrectionImpactV1','A1',7,14,45,'ACTIVE'),
('NEW_RESULT_INTAKE_AGENT','1.0.0','新结果接收协作者','CHILD','RESULT_FOLLOWUP_COORDINATOR','NEW_RESULT','汇总新增或更正结果及任务','新结果整理','正在核对结果状态和申请来源','贡献新结果事实和状态缺口','NewResultIntakeV1','A1',5,10,30,'ACTIVE'),
('RESULT_TREND_REVIEWER','1.0.0','结果趋势协作者','CHILD','RESULT_FOLLOWUP_COORDINATOR','RESULT_TREND','解释确定性计算后的可比趋势','结果趋势核对','正在核对单位和参考范围版本','贡献趋势、异常变化和不可比项','ResultTrendReviewV1','A1',6,14,40,'ACTIVE'),
('CRITICAL_RESULT_CONTEXT_AGENT','1.0.0','危急值上下文协作者','CHILD','RESULT_FOLLOWUP_COORDINATOR','CRITICAL_RESULT','汇总危急值规则和闭环状态','危急值上下文核对','正在核对规则、通知、接收和处置','贡献危急值上下文和未闭环状态','CriticalResultContextV1','A1',5,10,30,'ACTIVE'),
('PENDING_RESULT_TRACKER','1.0.0','待回结果跟踪协作者','CHILD','RESULT_FOLLOWUP_COORDINATOR','PENDING_RESULT','列出未报告、部分报告和更正中结果','待回结果跟踪','正在核对结果水位和报告状态','贡献待回结果清单','PendingResultListV1','A1',5,12,35,'ACTIVE'),
('FOLLOWUP_TASK_PLANNER','1.0.0','随访任务规划协作者','CHILD','RESULT_FOLLOWUP_COORDINATOR','FOLLOWUP_TASK','把已确认计划组织成任务候选','随访任务规划','正在核对责任人、期限和重复任务','贡献任务计划候选内容','FollowupTaskPlanV1','A1',6,12,40,'ACTIVE'),
('CORRECTED_RESULT_RECONCILER','1.0.0','更正结果对账协作者','CHILD','RESULT_FOLLOWUP_COORDINATOR','CORRECTED_RESULT','分析结果更正对文书和任务的影响','更正结果对账','正在构建结果版本影响图','贡献受影响对象和复核候选','CorrectedResultImpactV1','A1',7,16,50,'ACTIVE'),
('CONSULT_PREPARATION_AGENT','1.0.0','会诊准备协作者','CHILD','CARE_COORDINATOR','CONSULT','形成会诊摘要、问题和资料缺口','会诊资料准备','正在核对会诊目的和目标科室','贡献会诊事实包和问题清单','ConsultPreparationV1','A1',6,12,40,'ACTIVE'),
('MDT_BRIEF_AGENT','1.0.0','MDT 简报协作者','CHILD','CARE_COORDINATOR','MDT','形成多学科简报、分歧和待决问题','MDT 资料准备','正在整理获授权的多域资料','贡献 MDT 简报和待决问题','MdtBriefV1','A1',7,14,50,'ACTIVE'),
('TRANSFER_HANDOFF_AGENT','1.0.0','转科交接协作者','CHILD','CARE_COORDINATOR','TRANSFER','形成转床、转科或转院交接候选','转科交接准备','正在核对未完成医嘱和接收状态','贡献交接候选和未完成事项','TransferHandoffV1','A1',7,14,50,'ACTIVE'),
('DISCHARGE_TRANSITION_AGENT','1.0.0','出院衔接协作者','CHILD','CARE_COORDINATOR','DISCHARGE','将已确认出院计划组织为连续照护候选','出院衔接准备','正在核对用药、教育和随访责任','贡献连续照护候选','DischargeTransitionV1','A1',7,14,50,'ACTIVE'),
('FOLLOWUP_COORDINATION_AGENT','1.0.0','随访协调协作者','CHILD','CARE_COORDINATOR','FOLLOWUP','把已确认随访计划组织为提醒和任务候选','随访协调准备','正在核对计划、升级条件和渠道授权','贡献随访协调候选','FollowupCoordinationV1','A1',6,12,40,'ACTIVE'),
('TASK_RECONCILIATION_AGENT','1.0.0','任务对账协作者','CHILD','CARE_COORDINATOR','TASK_RECONCILIATION','对开放、重复、过期和转派任务提出建议','任务对账','正在核对任务来源状态和责任人','贡献任务对账建议','TaskReconciliationV1','A1',6,14,40,'ACTIVE');

insert into medical_agent_composition_release(
  composition_code, release_version, root_agent_code, max_depth, status)
values
('ENCOUNTER_SUMMARIZER_DEFAULT','1.0.0','ENCOUNTER_SUMMARIZER',1,'ACTIVE'),
('DOCUMENT_DRAFTER_DEFAULT','1.0.0','DOCUMENT_DRAFTER',1,'ACTIVE'),
('RECORD_QC_DEFAULT','1.0.0','RECORD_QC',1,'ACTIVE'),
('RESULT_FOLLOWUP_COORDINATOR_DEFAULT','1.0.0','RESULT_FOLLOWUP_COORDINATOR',1,'ACTIVE'),
('CARE_COORDINATOR_DEFAULT','1.0.0','CARE_COORDINATOR',1,'ACTIVE');

insert into medical_agent_composition_node(
  composition_code, release_version, child_agent_code, stage_code, node_order, critical, parallel_group)
select parent_agent_code || case parent_agent_code
    when 'RESULT_FOLLOWUP_COORDINATOR' then '_DEFAULT'
    else '_DEFAULT' end,
  release_version, agent_code, stage_code,
  row_number() over (partition by parent_agent_code order by agent_code),
  stage_code in ('TRIAGE','PERIOPERATIVE','PRE_SIGN','TERMINAL_RECORD','CRITICAL_RESULT'),
  'STAGE'
from medical_agent_release
where agent_level = 'CHILD';
