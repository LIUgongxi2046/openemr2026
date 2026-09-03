-- 临床路径知识内容层（方案 A：知识内容与执行分离，发布后生成 clinical_pathway_* 执行配置）。

create table pathway_knowledge (
  tenant_id uuid not null,
  pathway_knowledge_id uuid not null,
  pathway_code varchar(96) not null,
  display_name varchar(256) not null check (length(trim(display_name)) between 2 and 256),
  specialty_code varchar(96) not null,
  diagnosis_code varchar(96) not null,
  inclusion_criteria text,
  exclusion_criteria text,
  avg_los_days integer check (avg_los_days is null or avg_los_days > 0),
  status varchar(24) not null check (status in ('ACTIVE', 'RETIRED')),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, pathway_knowledge_id),
  unique (tenant_id, pathway_code),
  foreign key (tenant_id, created_by) references app_user(tenant_id, user_id)
);

create table pathway_knowledge_version (
  tenant_id uuid not null,
  pathway_version_id uuid not null,
  pathway_knowledge_id uuid not null,
  version_no integer not null check (version_no > 0),
  content_hash varchar(64) not null,
  status varchar(24) not null check (status in ('DRAFT', 'IN_REVIEW', 'APPROVED', 'ACTIVE', 'RETIRED')),
  submitted_by uuid not null,
  reviewed_by uuid,
  approved_by uuid,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  approved_at timestamptz,
  published_at timestamptz,
  primary key (tenant_id, pathway_version_id),
  unique (tenant_id, pathway_knowledge_id, version_no),
  foreign key (tenant_id, pathway_knowledge_id)
    references pathway_knowledge(tenant_id, pathway_knowledge_id),
  foreign key (tenant_id, submitted_by) references app_user(tenant_id, user_id),
  foreign key (tenant_id, reviewed_by) references app_user(tenant_id, user_id),
  foreign key (tenant_id, approved_by) references app_user(tenant_id, user_id),
  check ((status in ('ACTIVE', 'RETIRED')) = (approved_by is not null and approved_at is not null)),
  check (reviewed_by is null or reviewed_by <> submitted_by),
  check (approved_by is null or approved_by <> reviewed_by)
);

create unique index pathway_knowledge_version_one_active_idx
  on pathway_knowledge_version (tenant_id, pathway_knowledge_id) where status = 'ACTIVE';

create table pathway_knowledge_stage (
  tenant_id uuid not null,
  stage_id uuid not null,
  pathway_version_id uuid not null,
  stage_code varchar(96) not null,
  stage_name varchar(256) not null check (length(trim(stage_name)) between 2 and 256),
  sequence_no integer not null check (sequence_no > 0),
  expected_day_start integer not null check (expected_day_start >= 0),
  expected_day_end integer not null check (expected_day_end >= expected_day_start),
  stage_goal text,
  assessment_points text,
  primary key (tenant_id, stage_id),
  unique (tenant_id, pathway_version_id, sequence_no),
  foreign key (tenant_id, pathway_version_id)
    references pathway_knowledge_version(tenant_id, pathway_version_id)
);

create table pathway_knowledge_task (
  tenant_id uuid not null,
  task_id uuid not null,
  stage_id uuid not null,
  task_type varchar(24) not null check (task_type in ('MEDICATION', 'LAB', 'IMAGING', 'NURSING', 'EDUCATION', 'ASSESSMENT')),
  content text not null check (length(trim(content)) >= 1),
  code_ref varchar(128),
  required boolean not null default true,
  sequence_no integer not null check (sequence_no > 0),
  primary key (tenant_id, task_id),
  unique (tenant_id, stage_id, sequence_no),
  foreign key (tenant_id, stage_id) references pathway_knowledge_stage(tenant_id, stage_id)
);

create table pathway_knowledge_variance (
  tenant_id uuid not null,
  variance_id uuid not null,
  pathway_version_id uuid not null,
  variance_type varchar(48) not null check (length(trim(variance_type)) >= 2),
  trigger_condition text,
  disposition text,
  record_requirement text,
  primary key (tenant_id, variance_id),
  foreign key (tenant_id, pathway_version_id)
    references pathway_knowledge_version(tenant_id, pathway_version_id)
);

create table pathway_knowledge_quality_point (
  tenant_id uuid not null,
  quality_point_id uuid not null,
  pathway_version_id uuid not null,
  indicator varchar(256) not null check (length(trim(indicator)) >= 2),
  standard text,
  frequency varchar(64),
  primary key (tenant_id, quality_point_id),
  foreign key (tenant_id, pathway_version_id)
    references pathway_knowledge_version(tenant_id, pathway_version_id)
);
