create table device_status (
  tenant_id uuid not null,
  device_code varchar(128) not null,
  online_status varchar(16) not null check (online_status in ('ONLINE', 'DEGRADED', 'OFFLINE')),
  clock_offset_seconds integer not null default 0,
  bound_patient_id uuid,
  last_observed_at timestamptz,
  calibration_status varchar(16) not null check (calibration_status in ('VALID', 'DUE_REVIEW')),
  alarm_state varchar(16) not null check (alarm_state in ('NONE', 'MEDIUM', 'HIGH')),
  row_version bigint not null default 1,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, device_code)
);

create table device_observation (
  tenant_id uuid not null,
  observation_id uuid not null,
  device_code varchar(128) not null,
  trace_id varchar(64) not null,
  metric varchar(32) not null,
  metric_value numeric(14, 3) not null,
  metric_unit varchar(16) not null,
  quality varchar(16) not null check (quality in ('VERIFIED', 'SUSPECT')),
  alarm_level varchar(16) not null check (alarm_level in ('NONE', 'MEDIUM', 'HIGH')),
  observed_at timestamptz not null,
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  primary key (tenant_id, observation_id)
);

create index device_observation_device_idx on device_observation (tenant_id, device_code, observed_at desc);
create index device_status_alarm_idx on device_status (tenant_id, alarm_state);
