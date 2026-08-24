create table inpatient_clinical_event (
  tenant_id uuid not null,
  clinical_event_id uuid not null,
  admission_id uuid not null,
  event_type varchar(48) not null check (event_type in (
    'CONSULTATION_REQUESTED', 'PREOPERATIVE_DECISION', 'OPERATION_COMPLETED',
    'RESCUE_COMPLETED', 'TRANSFUSION_COMPLETED', 'CRITICAL_ILLNESS_DECLARED',
    'DEATH_CONFIRMED')),
  occurred_at timestamptz not null,
  summary varchar(1000) not null check (length(trim(summary)) > 0),
  source_system varchar(96) not null,
  source_event_key varchar(256) not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, clinical_event_id),
  unique (tenant_id, source_system, source_event_key),
  foreign key (tenant_id, admission_id)
    references inpatient_admission(tenant_id, admission_id),
  foreign key (tenant_id, created_by) references app_user(tenant_id, user_id)
);

create index inpatient_clinical_event_admission_timeline_idx
  on inpatient_clinical_event (tenant_id, admission_id, occurred_at desc);

