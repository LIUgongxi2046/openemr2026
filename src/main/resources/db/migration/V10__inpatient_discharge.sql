create table inpatient_discharge (
  tenant_id uuid not null,
  discharge_id uuid not null,
  admission_id uuid not null,
  discharge_diagnosis varchar(2000) not null check (length(trim(discharge_diagnosis)) > 0),
  disposition_code varchar(32) not null
    check (disposition_code in ('HOME', 'TRANSFER_TO_FACILITY', 'DEATH', 'OTHER')),
  outstanding_task_waiver_reason varchar(1000),
  discharged_by uuid not null,
  discharged_at timestamptz not null,
  row_version bigint not null default 1 check (row_version > 0),
  primary key (tenant_id, discharge_id),
  unique (tenant_id, admission_id),
  foreign key (tenant_id, admission_id) references inpatient_admission(tenant_id, admission_id),
  foreign key (tenant_id, discharged_by) references app_user(tenant_id, user_id),
  check (outstanding_task_waiver_reason is null
    or length(trim(outstanding_task_waiver_reason)) > 0)
);
