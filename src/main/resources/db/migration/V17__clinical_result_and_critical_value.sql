create table clinical_result (
  tenant_id uuid not null,
  result_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  order_id uuid not null,
  execution_task_id uuid not null,
  report_type varchar(24) not null check (report_type in ('LAB', 'IMAGING')),
  source_system varchar(128) not null check (length(trim(source_system)) > 0),
  source_report_key varchar(256) not null check (length(trim(source_report_key)) > 0),
  current_version_id uuid not null,
  author_user_id uuid not null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, result_id),
  unique (tenant_id, source_system, source_report_key),
  unique (tenant_id, execution_task_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, order_id) references clinical_order(tenant_id, order_id),
  foreign key (tenant_id, execution_task_id) references order_execution_task(tenant_id, execution_task_id),
  foreign key (tenant_id, author_user_id) references app_user(tenant_id, user_id)
);

create index clinical_result_encounter_idx
  on clinical_result (tenant_id, encounter_id, updated_at desc);

create table clinical_result_version (
  tenant_id uuid not null,
  result_version_id uuid not null,
  result_id uuid not null,
  version_no bigint not null check (version_no > 0),
  report_status varchar(24) not null check (report_status in ('FINAL', 'CORRECTED')),
  conclusion varchar(4000) not null check (length(trim(conclusion)) > 0),
  reported_at timestamptz not null,
  change_type varchar(24) not null check (change_type in ('INITIAL', 'CORRECTION')),
  correction_reason varchar(1000),
  supersedes_version_id uuid,
  authored_by uuid not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, result_version_id),
  unique (tenant_id, result_id, version_no),
  foreign key (tenant_id, result_id) references clinical_result(tenant_id, result_id),
  foreign key (tenant_id, supersedes_version_id)
    references clinical_result_version(tenant_id, result_version_id),
  foreign key (tenant_id, authored_by) references app_user(tenant_id, user_id),
  check ((change_type = 'CORRECTION') = (correction_reason is not null)),
  check (correction_reason is null or length(trim(correction_reason)) > 0)
);

alter table clinical_result add constraint clinical_result_current_version_fk
  foreign key (tenant_id, current_version_id)
  references clinical_result_version(tenant_id, result_version_id)
  deferrable initially deferred;

create table clinical_result_observation (
  tenant_id uuid not null,
  observation_id uuid not null,
  result_version_id uuid not null,
  item_code varchar(128) not null check (length(trim(item_code)) > 0),
  item_name varchar(256) not null check (length(trim(item_name)) > 0),
  value_type varchar(16) not null check (value_type in ('NUMERIC', 'TEXT')),
  numeric_value numeric(24,6),
  text_value varchar(4000),
  unit varchar(64),
  reference_low numeric(24,6),
  reference_high numeric(24,6),
  abnormal_flag varchar(24) not null check (abnormal_flag in (
    'NORMAL', 'HIGH', 'LOW', 'CRITICAL_HIGH', 'CRITICAL_LOW')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, observation_id),
  unique (tenant_id, result_version_id, item_code),
  foreign key (tenant_id, result_version_id)
    references clinical_result_version(tenant_id, result_version_id),
  check ((value_type = 'NUMERIC') = (numeric_value is not null)),
  check ((value_type = 'TEXT') = (text_value is not null)),
  check (reference_low is null or reference_high is null or reference_low <= reference_high)
);

create table critical_value_case (
  tenant_id uuid not null,
  critical_value_id uuid not null,
  result_id uuid not null,
  observation_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  state varchar(24) not null check (state in ('OPEN', 'ACKNOWLEDGED', 'DISPOSED')),
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, critical_value_id),
  unique (tenant_id, observation_id),
  foreign key (tenant_id, result_id) references clinical_result(tenant_id, result_id),
  foreign key (tenant_id, observation_id) references clinical_result_observation(tenant_id, observation_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id)
);

create index critical_value_case_state_idx
  on critical_value_case (tenant_id, state, updated_at);

create table critical_value_event (
  tenant_id uuid not null,
  critical_value_event_id uuid not null,
  critical_value_id uuid not null,
  event_type varchar(24) not null check (event_type in ('CREATED', 'ACKNOWLEDGED', 'DISPOSED')),
  actor_user_id uuid not null,
  notification_method varchar(64),
  recipient_confirmed boolean,
  assessment varchar(2000),
  action_taken varchar(2000),
  outcome varchar(2000),
  retest_required boolean,
  occurred_at timestamptz not null default now(),
  primary key (tenant_id, critical_value_event_id),
  foreign key (tenant_id, critical_value_id)
    references critical_value_case(tenant_id, critical_value_id),
  foreign key (tenant_id, actor_user_id) references app_user(tenant_id, user_id),
  check (event_type <> 'ACKNOWLEDGED' or (
    notification_method is not null and recipient_confirmed is not null)),
  check (event_type <> 'DISPOSED' or (
    assessment is not null and action_taken is not null and outcome is not null and retest_required is not null))
);

create function prevent_clinical_result_fact_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'clinical result facts are immutable';
end $$;

create trigger clinical_result_version_immutable
  before update or delete on clinical_result_version
  for each row execute function prevent_clinical_result_fact_mutation();

create trigger clinical_result_observation_immutable
  before update or delete on clinical_result_observation
  for each row execute function prevent_clinical_result_fact_mutation();

create trigger critical_value_event_immutable
  before update or delete on critical_value_event
  for each row execute function prevent_clinical_result_fact_mutation();
