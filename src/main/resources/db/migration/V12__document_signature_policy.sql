alter table inpatient_document_task
  add column required_signature_level varchar(32);

update inpatient_document_task task
set required_signature_level = rule.required_signature_level
from inpatient_document_rule rule
where rule.tenant_id = task.tenant_id
  and rule.document_type_code = task.document_type_code
  and rule.rule_version = task.rule_version;

alter table inpatient_document_task
  alter column required_signature_level set not null,
  add constraint inpatient_document_task_signature_level_check
    check (required_signature_level in ('AUTHOR', 'ATTENDING', 'CHIEF', 'MEDICAL_RECORDS'));

create table document_signature_policy (
  tenant_id uuid not null,
  document_id uuid not null,
  document_version_id uuid not null,
  required_signature_level varchar(32) not null
    check (required_signature_level in ('AUTHOR', 'ATTENDING', 'CHIEF', 'MEDICAL_RECORDS')),
  current_signature_level varchar(32)
    check (current_signature_level in ('AUTHOR', 'ATTENDING', 'CHIEF', 'MEDICAL_RECORDS')),
  review_status varchar(24) not null default 'PENDING'
    check (review_status in ('PENDING', 'IN_REVIEW', 'COMPLETED', 'REJECTED')),
  requires_distinct_signers boolean not null default true,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, document_id, document_version_id),
  foreign key (tenant_id, document_id, document_version_id)
    references clinical_document_version(tenant_id, document_id, document_version_id),
  check ((review_status = 'PENDING') = (current_signature_level is null)),
  check (review_status <> 'COMPLETED' or current_signature_level = required_signature_level)
);

create index document_signature_policy_pending_idx
  on document_signature_policy (tenant_id, required_signature_level, current_signature_level)
  where review_status in ('PENDING', 'IN_REVIEW');

create table document_review_decision (
  tenant_id uuid not null,
  review_decision_id uuid not null,
  document_id uuid not null,
  document_version_id uuid not null,
  decision varchar(16) not null check (decision in ('REJECTED')),
  decision_level varchar(32) not null
    check (decision_level in ('ATTENDING', 'CHIEF', 'MEDICAL_RECORDS')),
  reason varchar(1000) not null check (length(trim(reason)) > 0),
  actor_user_id uuid not null,
  decided_at timestamptz not null default now(),
  primary key (tenant_id, review_decision_id),
  foreign key (tenant_id, document_id, document_version_id)
    references clinical_document_version(tenant_id, document_id, document_version_id),
  foreign key (tenant_id, actor_user_id) references app_user(tenant_id, user_id)
);
