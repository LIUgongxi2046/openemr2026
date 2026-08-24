create table clinical_pathway_definition (
  tenant_id uuid not null,
  pathway_definition_id uuid not null,
  pathway_code varchar(96) not null,
  display_name varchar(256) not null check (length(trim(display_name)) between 2 and 256),
  specialty_code varchar(96) not null,
  diagnosis_code varchar(96) not null,
  status varchar(24) not null check (status in ('ACTIVE', 'RETIRED')),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, pathway_definition_id),
  unique (tenant_id, pathway_code),
  foreign key (tenant_id, created_by) references app_user(tenant_id, user_id)
);

create table clinical_pathway_version (
  tenant_id uuid not null,
  pathway_version_id uuid not null,
  pathway_definition_id uuid not null,
  version_no integer not null check (version_no > 0),
  status varchar(24) not null check (status in ('DRAFT', 'PUBLISHED', 'RETIRED')),
  admission_criteria text not null check (length(trim(admission_criteria)) between 4 and 4000),
  created_by uuid not null,
  approved_by uuid,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  primary key (tenant_id, pathway_version_id),
  unique (tenant_id, pathway_definition_id, version_no),
  foreign key (tenant_id, pathway_definition_id)
    references clinical_pathway_definition(tenant_id, pathway_definition_id),
  foreign key (tenant_id, created_by) references app_user(tenant_id, user_id),
  foreign key (tenant_id, approved_by) references app_user(tenant_id, user_id),
  check ((status = 'PUBLISHED') = (published_at is not null and approved_by is not null)),
  check (approved_by is null or approved_by <> created_by)
);

create table clinical_pathway_stage (
  tenant_id uuid not null,
  pathway_version_id uuid not null,
  stage_code varchar(96) not null,
  display_name varchar(256) not null check (length(trim(display_name)) between 2 and 256),
  sequence_no integer not null check (sequence_no > 0),
  expected_day_start integer not null check (expected_day_start >= 0),
  expected_day_end integer not null check (expected_day_end >= expected_day_start),
  primary key (tenant_id, pathway_version_id, stage_code),
  unique (tenant_id, pathway_version_id, sequence_no),
  foreign key (tenant_id, pathway_version_id)
    references clinical_pathway_version(tenant_id, pathway_version_id)
);

create table clinical_pathway_stage_task (
  tenant_id uuid not null,
  pathway_version_id uuid not null,
  stage_code varchar(96) not null,
  task_code varchar(96) not null,
  display_name varchar(256) not null check (length(trim(display_name)) between 2 and 256),
  source_type varchar(24) not null check (source_type in ('DOCUMENT_TASK', 'ORDER_ITEM')),
  source_key varchar(128) not null check (length(trim(source_key)) between 2 and 128),
  required boolean not null default true,
  sequence_no integer not null check (sequence_no > 0),
  primary key (tenant_id, pathway_version_id, task_code),
  unique (tenant_id, pathway_version_id, stage_code, sequence_no),
  foreign key (tenant_id, pathway_version_id, stage_code)
    references clinical_pathway_stage(tenant_id, pathway_version_id, stage_code)
);

create table inpatient_pathway_instance (
  tenant_id uuid not null,
  pathway_instance_id uuid not null,
  admission_id uuid not null,
  organization_id uuid not null,
  facility_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  pathway_definition_id uuid not null,
  pathway_version_id uuid not null,
  status varchar(24) not null check (status in ('ACTIVE', 'COMPLETED', 'EXITED')),
  current_stage_code varchar(96) not null,
  admission_basis text not null check (length(trim(admission_basis)) between 4 and 2000),
  enrolled_by uuid not null,
  enrolled_at timestamptz not null default now(),
  completed_by uuid,
  completed_at timestamptz,
  exited_by_variance_id uuid,
  row_version bigint not null default 1 check (row_version > 0),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, pathway_instance_id),
  foreign key (tenant_id, admission_id) references inpatient_admission(tenant_id, admission_id),
  foreign key (tenant_id, pathway_definition_id)
    references clinical_pathway_definition(tenant_id, pathway_definition_id),
  foreign key (tenant_id, pathway_version_id)
    references clinical_pathway_version(tenant_id, pathway_version_id),
  foreign key (tenant_id, pathway_version_id, current_stage_code)
    references clinical_pathway_stage(tenant_id, pathway_version_id, stage_code),
  foreign key (tenant_id, enrolled_by) references app_user(tenant_id, user_id),
  foreign key (tenant_id, completed_by) references app_user(tenant_id, user_id),
  check ((status = 'COMPLETED') = (completed_by is not null and completed_at is not null)),
  check (status <> 'EXITED' or exited_by_variance_id is not null)
);

create unique index inpatient_pathway_one_active_idx
  on inpatient_pathway_instance(tenant_id, admission_id) where status = 'ACTIVE';
create index inpatient_pathway_admission_idx
  on inpatient_pathway_instance(tenant_id, admission_id, enrolled_at desc);

create table inpatient_pathway_task (
  tenant_id uuid not null,
  pathway_task_id uuid not null,
  pathway_instance_id uuid not null,
  stage_code varchar(96) not null,
  task_code varchar(96) not null,
  display_name varchar(256) not null,
  source_type varchar(24) not null check (source_type in ('DOCUMENT_TASK', 'ORDER_ITEM')),
  source_key varchar(128) not null,
  required boolean not null,
  sequence_no integer not null check (sequence_no > 0),
  state varchar(24) not null check (state in ('PENDING', 'COMPLETED', 'WAIVED')),
  source_resource_id uuid,
  source_status varchar(32),
  completed_at timestamptz,
  waived_by_variance_id uuid,
  primary key (tenant_id, pathway_task_id),
  unique (tenant_id, pathway_instance_id, task_code),
  foreign key (tenant_id, pathway_instance_id)
    references inpatient_pathway_instance(tenant_id, pathway_instance_id),
  check ((state = 'COMPLETED') = (source_resource_id is not null and completed_at is not null)),
  check ((state = 'WAIVED') = (waived_by_variance_id is not null)),
  check (state <> 'PENDING' or (source_resource_id is null and completed_at is null and waived_by_variance_id is null))
);

create table inpatient_pathway_variance (
  tenant_id uuid not null,
  variance_id uuid not null,
  pathway_instance_id uuid not null,
  variance_type varchar(32) not null check (variance_type in (
    'CONTRAINDICATION', 'RESOURCE_UNAVAILABLE', 'PATIENT_REFUSAL',
    'DIAGNOSIS_CHANGED', 'TASK_FAILED', 'OTHER')),
  reason text not null check (length(trim(reason)) between 4 and 2000),
  disposition varchar(24) not null check (disposition in ('CONTINUE', 'WAIVE_TASK', 'EXIT_PATHWAY')),
  affected_task_id uuid,
  status varchar(24) not null check (status in ('REQUESTED', 'APPROVED', 'REJECTED')),
  requested_by uuid not null,
  requested_at timestamptz not null default now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  primary key (tenant_id, variance_id),
  foreign key (tenant_id, pathway_instance_id)
    references inpatient_pathway_instance(tenant_id, pathway_instance_id),
  foreign key (tenant_id, affected_task_id)
    references inpatient_pathway_task(tenant_id, pathway_task_id),
  foreign key (tenant_id, requested_by) references app_user(tenant_id, user_id),
  foreign key (tenant_id, reviewed_by) references app_user(tenant_id, user_id),
  check ((status = 'REQUESTED') = (reviewed_by is null and reviewed_at is null and review_note is null)),
  check (reviewed_by is null or reviewed_by <> requested_by),
  check ((disposition = 'WAIVE_TASK') = (affected_task_id is not null)),
  check (disposition <> 'EXIT_PATHWAY' or affected_task_id is null)
);

alter table inpatient_pathway_task
  add foreign key (tenant_id, waived_by_variance_id)
    references inpatient_pathway_variance(tenant_id, variance_id);
alter table inpatient_pathway_instance
  add foreign key (tenant_id, exited_by_variance_id)
    references inpatient_pathway_variance(tenant_id, variance_id);

create index inpatient_pathway_variance_review_idx
  on inpatient_pathway_variance(tenant_id, status, requested_at)
  where status = 'REQUESTED';

create or replace function protect_clinical_pathway_definition_evidence()
returns trigger language plpgsql as $protect$
begin
  if tg_op = 'DELETE' then
    raise exception 'clinical pathway definition evidence is immutable' using errcode = '23514';
  end if;
  if old.status in ('PUBLISHED', 'RETIRED') then
    raise exception 'published clinical pathway definition evidence is immutable' using errcode = '23514';
  end if;
  return new;
end
$protect$;

create trigger clinical_pathway_version_protect
before update or delete on clinical_pathway_version
for each row execute function protect_clinical_pathway_definition_evidence();

create or replace function prevent_clinical_pathway_template_mutation()
returns trigger language plpgsql as $protect$
begin
  raise exception 'clinical pathway stage template evidence is immutable' using errcode = '23514';
end
$protect$;

create trigger clinical_pathway_stage_protect
before update or delete on clinical_pathway_stage
for each row execute function prevent_clinical_pathway_template_mutation();
create trigger clinical_pathway_stage_task_protect
before update or delete on clinical_pathway_stage_task
for each row execute function prevent_clinical_pathway_template_mutation();

create or replace function protect_inpatient_pathway_instance()
returns trigger language plpgsql as $protect$
begin
  if tg_op = 'DELETE' then
    raise exception 'inpatient pathway instance is immutable' using errcode = '23514';
  end if;
  if new.tenant_id <> old.tenant_id
     or new.pathway_instance_id <> old.pathway_instance_id
     or new.admission_id <> old.admission_id
     or new.organization_id <> old.organization_id
     or new.facility_id <> old.facility_id
     or new.patient_id <> old.patient_id
     or new.encounter_id <> old.encounter_id
     or new.pathway_definition_id <> old.pathway_definition_id
     or new.pathway_version_id <> old.pathway_version_id
     or new.admission_basis <> old.admission_basis
     or new.enrolled_by <> old.enrolled_by
     or new.enrolled_at <> old.enrolled_at then
    raise exception 'enrollment and bound pathway version are immutable' using errcode = '23514';
  end if;
  if new.row_version <> old.row_version + 1 then
    raise exception 'pathway row version must increase exactly once' using errcode = '23514';
  end if;
  if old.status <> 'ACTIVE' and row(new.status, new.current_stage_code, new.completed_by,
      new.completed_at, new.exited_by_variance_id) is distinct from
      row(old.status, old.current_stage_code, old.completed_by, old.completed_at, old.exited_by_variance_id) then
    raise exception 'terminal pathway evidence is immutable' using errcode = '23514';
  end if;
  if old.status = 'ACTIVE' and new.status not in ('ACTIVE', 'COMPLETED', 'EXITED') then
    raise exception 'invalid pathway state transition' using errcode = '23514';
  end if;
  return new;
end
$protect$;

create trigger inpatient_pathway_instance_protect
before update or delete on inpatient_pathway_instance
for each row execute function protect_inpatient_pathway_instance();

create or replace function protect_inpatient_pathway_task()
returns trigger language plpgsql as $protect$
begin
  if tg_op = 'DELETE' then
    raise exception 'inpatient pathway task evidence is immutable' using errcode = '23514';
  end if;
  if row(new.tenant_id, new.pathway_task_id, new.pathway_instance_id, new.stage_code,
      new.task_code, new.display_name, new.source_type, new.source_key, new.required,
      new.sequence_no) is distinct from
     row(old.tenant_id, old.pathway_task_id, old.pathway_instance_id, old.stage_code,
      old.task_code, old.display_name, old.source_type, old.source_key, old.required,
      old.sequence_no) then
    raise exception 'pathway task definition copy is immutable' using errcode = '23514';
  end if;
  if old.state <> 'PENDING' and row(new.state, new.source_resource_id, new.source_status,
      new.completed_at, new.waived_by_variance_id) is distinct from
      row(old.state, old.source_resource_id, old.source_status, old.completed_at,
      old.waived_by_variance_id) then
    raise exception 'terminal pathway task evidence is immutable' using errcode = '23514';
  end if;
  if old.state = 'PENDING' and new.state not in ('PENDING', 'COMPLETED', 'WAIVED') then
    raise exception 'invalid pathway task transition' using errcode = '23514';
  end if;
  return new;
end
$protect$;

create trigger inpatient_pathway_task_protect
before update or delete on inpatient_pathway_task
for each row execute function protect_inpatient_pathway_task();

create or replace function protect_inpatient_pathway_variance()
returns trigger language plpgsql as $protect$
begin
  if tg_op = 'DELETE' then
    raise exception 'pathway variance evidence is immutable' using errcode = '23514';
  end if;
  if row(new.tenant_id, new.variance_id, new.pathway_instance_id, new.variance_type,
      new.reason, new.disposition, new.affected_task_id, new.requested_by, new.requested_at)
      is distinct from
     row(old.tenant_id, old.variance_id, old.pathway_instance_id, old.variance_type,
      old.reason, old.disposition, old.affected_task_id, old.requested_by, old.requested_at) then
    raise exception 'pathway variance request evidence is immutable' using errcode = '23514';
  end if;
  if old.status <> 'REQUESTED' then
    raise exception 'reviewed pathway variance is immutable' using errcode = '23514';
  end if;
  if new.status not in ('APPROVED', 'REJECTED')
     or new.reviewed_by is null or new.reviewed_at is null or new.review_note is null then
    raise exception 'invalid pathway variance review evidence' using errcode = '23514';
  end if;
  return new;
end
$protect$;

create trigger inpatient_pathway_variance_protect
before update or delete on inpatient_pathway_variance
for each row execute function protect_inpatient_pathway_variance();
