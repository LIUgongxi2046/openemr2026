create table mock_interface_run (
  tenant_id uuid not null,
  run_id uuid not null,
  profile_id uuid not null,
  workbench_id varchar(96) not null,
  interface_code varchar(64) not null,
  scenario varchar(24) not null,
  status varchar(32) not null,
  idempotency_key varchar(128) not null,
  request_hash char(64) not null,
  profile_version bigint not null,
  record_count integer not null,
  result_payload jsonb not null default '{}'::jsonb,
  agent_assessment jsonb not null default '{}'::jsonb,
  evidence_hash char(64) not null,
  created_by uuid not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (tenant_id, run_id),
  unique (tenant_id, idempotency_key),
  foreign key (tenant_id, profile_id) references config_item(tenant_id, config_id),
  foreign key (tenant_id, created_by) references app_user(tenant_id, user_id),
  constraint mock_interface_run_scenario_check check (scenario in ('SUCCESS', 'DEGRADED', 'UNAVAILABLE')),
  constraint mock_interface_run_status_check check (status in ('COMPLETED', 'REVIEW_REQUIRED', 'BLOCKED', 'FAILED')),
  constraint mock_interface_run_profile_version_check check (profile_version > 0),
  constraint mock_interface_run_record_count_check check (record_count between 0 and 200),
  constraint mock_interface_run_completion_check check ((status = 'FAILED') or completed_at is not null)
);

create index mock_interface_run_workbench_idx
  on mock_interface_run (tenant_id, workbench_id, started_at desc, run_id desc);

create index mock_interface_run_profile_idx
  on mock_interface_run (tenant_id, profile_id, started_at desc, run_id desc);

create table mock_interface_run_event (
  tenant_id uuid not null,
  run_id uuid not null,
  sequence_no integer not null,
  event_type varchar(64) not null,
  event_status varchar(24) not null,
  summary varchar(500) not null,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  primary key (tenant_id, run_id, sequence_no),
  foreign key (tenant_id, run_id) references mock_interface_run(tenant_id, run_id),
  constraint mock_interface_run_event_sequence_check check (sequence_no > 0),
  constraint mock_interface_run_event_status_check check (event_status in ('PASS', 'REVIEW', 'BLOCK'))
);

create unique index mock_interface_one_active_profile_per_workbench_idx
  on config_item (tenant_id, (payload->>'workbench_id'))
  where config_type = 'MOCK_INTERFACE_PROFILE' and status = 'ACTIVE';

update config_item
set payload = payload || jsonb_build_object(
      'organization_code', '91320100MA3JCUH001',
      'facility_code', case payload->>'facility'
        when '东院区' then 'JC-DONG'
        when '感染病院区' then 'JC-INFECTIOUS'
        else 'JC-BENBU' end,
      'china_standard_profile', jsonb_build_object(
        'hospital_platform', 'WS/T 846.1-846.11—2024',
        'hospital_platform_function', 'WS/T 847—2024',
        'medical_record_management', '医疗机构病历管理规定（2013年版）',
        'data_minimization', true,
        'cross_border_allowed', false),
      'production_adapter_state', 'SYNTHETIC_ONLY',
      'agent_policy', jsonb_build_object(
        'mode', 'RULE_GUARDED',
        'clinical_write_allowed', false,
        'human_review_on_degraded', true,
        'block_on_identity_mismatch', true),
      'documentation_version', 'v2.0 / 2026-08-31')
where config_type = 'MOCK_INTERFACE_PROFILE'
  and status <> 'ARCHIVED';

update config_item
set payload = jsonb_set(payload, '{critical_value_policy}', '{
  "policy_code":"JC-LAB-CRITICAL-2026-01",
  "policy_name":"江城大学附属医院成人检验危急值演练目录",
  "requires_recheck":true,
  "requires_reporter_receiver_ack":true,
  "requires_closed_loop":true,
  "thresholds":{"WBC":{"low":1.0,"high":30.0},"HGB":{"low":50.0,"high":200.0},"PLT":{"low":20.0,"high":1000.0},"K":{"low":2.5,"high":6.5},"NA":{"low":120.0,"high":160.0},"CREA":{"high":707.0},"GLU":{"low":2.8,"high":22.2}}
}'::jsonb, true)
where config_type = 'MOCK_INTERFACE_PROFILE'
  and payload->>'interface_code' = 'LIS_RESULTS'
  and status <> 'ARCHIVED';
