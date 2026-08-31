create table data_quality_scan_run (
  tenant_id uuid not null,
  data_quality_scan_id uuid not null,
  data_quality_rule_id uuid not null,
  facility_id uuid not null,
  target_entity varchar(128) not null,
  status varchar(24) not null check (status in ('RUNNING', 'COMPLETED', 'NO_DATA', 'FAILED')),
  total_count bigint not null default 0 check (total_count >= 0),
  passed_count bigint not null default 0 check (passed_count >= 0),
  failed_count bigint not null default 0 check (failed_count >= 0),
  score numeric(7,6) not null default 0 check (score between 0 and 1),
  started_by uuid not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  row_version bigint not null default 1 check (row_version > 0),
  primary key (tenant_id, data_quality_scan_id),
  foreign key (tenant_id, data_quality_rule_id)
    references data_quality_rule(tenant_id, data_quality_rule_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, started_by) references app_user(tenant_id, user_id),
  check (total_count = passed_count + failed_count),
  check ((status = 'RUNNING') = (completed_at is null))
);

create index data_quality_scan_rule_idx
  on data_quality_scan_run (tenant_id, data_quality_rule_id, started_at desc, data_quality_scan_id desc);

create table data_quality_finding (
  tenant_id uuid not null,
  data_quality_finding_id uuid not null,
  data_quality_scan_id uuid not null,
  data_quality_rule_id uuid not null,
  target_entity_id uuid not null,
  reason_code varchar(96) not null,
  reason_detail varchar(1000) not null,
  severity varchar(16) not null check (severity in ('INFO', 'WARNING', 'BLOCKING')),
  status varchar(24) not null check (status in ('OPEN', 'ASSIGNED', 'REMEDIATED', 'VERIFIED', 'CLOSED')),
  assigned_to uuid,
  corrective_action varchar(2000),
  detected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version bigint not null default 1 check (row_version > 0),
  primary key (tenant_id, data_quality_finding_id),
  unique (tenant_id, data_quality_scan_id, target_entity_id, reason_code),
  foreign key (tenant_id, data_quality_scan_id)
    references data_quality_scan_run(tenant_id, data_quality_scan_id),
  foreign key (tenant_id, data_quality_rule_id)
    references data_quality_rule(tenant_id, data_quality_rule_id),
  foreign key (tenant_id, assigned_to) references app_user(tenant_id, user_id),
  check (status <> 'ASSIGNED' or assigned_to is not null),
  check (status not in ('REMEDIATED', 'VERIFIED', 'CLOSED')
    or length(trim(corrective_action)) >= 2)
);

create index data_quality_finding_work_queue_idx
  on data_quality_finding (tenant_id, status, severity, updated_at desc, data_quality_finding_id);

create table data_quality_finding_event (
  tenant_id uuid not null,
  data_quality_finding_event_id uuid not null,
  data_quality_finding_id uuid not null,
  event_type varchar(24) not null check (event_type in ('DETECTED', 'ASSIGNED', 'REMEDIATED', 'VERIFIED', 'CLOSED', 'REOPENED')),
  from_status varchar(24),
  to_status varchar(24) not null,
  note varchar(2000),
  actor_user_id uuid not null,
  occurred_at timestamptz not null default now(),
  primary key (tenant_id, data_quality_finding_event_id),
  foreign key (tenant_id, data_quality_finding_id)
    references data_quality_finding(tenant_id, data_quality_finding_id),
  foreign key (tenant_id, actor_user_id) references app_user(tenant_id, user_id)
);

create table data_quality_triage_advice (
  tenant_id uuid not null,
  data_quality_triage_advice_id uuid not null,
  data_quality_scan_id uuid not null,
  engine_kind varchar(48) not null check (engine_kind = 'DETERMINISTIC_RULE_BASED'),
  risk_level varchar(16) not null check (risk_level in ('LOW', 'MEDIUM', 'HIGH')),
  finding_count bigint not null check (finding_count >= 0),
  summary varchar(1000) not null,
  prioritized_actions jsonb not null check (jsonb_typeof(prioritized_actions) = 'array'),
  evidence_hash char(64) not null check (evidence_hash ~ '^[0-9a-f]{64}$'),
  generated_by uuid not null,
  generated_at timestamptz not null default now(),
  primary key (tenant_id, data_quality_triage_advice_id),
  foreign key (tenant_id, data_quality_scan_id)
    references data_quality_scan_run(tenant_id, data_quality_scan_id),
  foreign key (tenant_id, generated_by) references app_user(tenant_id, user_id)
);

create index data_quality_triage_scan_idx
  on data_quality_triage_advice (tenant_id, data_quality_scan_id, generated_at desc);

create function protect_data_quality_scan_evidence() returns trigger language plpgsql as $$
begin
  if tg_table_name = 'data_quality_scan_run' and old.status <> 'RUNNING' then
    raise exception 'completed data quality scan evidence is immutable';
  end if;
  if tg_op = 'DELETE' then
    raise exception 'data quality evidence cannot be deleted';
  end if;
  return new;
end $$;

create trigger data_quality_scan_evidence_guard
  before update or delete on data_quality_scan_run
  for each row execute function protect_data_quality_scan_evidence();

create trigger data_quality_finding_event_immutable
  before update or delete on data_quality_finding_event
  for each row execute function prevent_data_quality_evaluation_mutation();

create trigger data_quality_triage_advice_immutable
  before update or delete on data_quality_triage_advice
  for each row execute function prevent_data_quality_evaluation_mutation();
