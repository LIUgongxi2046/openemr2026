create table device (
  tenant_id uuid not null,
  device_id uuid not null,
  device_code varchar(128) not null,
  display_name varchar(256) not null check (length(trim(display_name)) >= 2),
  device_type varchar(32) not null check (device_type in ('MONITOR', 'VENTILATOR', 'INFUSION_PUMP', 'IMAGING', 'LAB_ANALYZER')),
  manufacturer_model varchar(256),
  department varchar(256),
  gateway varchar(256),
  standard_interface varchar(256),
  calibration_due date,
  clock_offset_seconds integer not null default 0,
  binding_policy text,
  status varchar(16) not null check (status in ('ACTIVE', 'INACTIVE')),
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, device_id),
  unique (tenant_id, device_code)
);

create index device_status_idx on device (tenant_id, status, device_code);

create function prevent_device_code_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'device identity code is immutable once defined';
end $$;

create trigger device_code_immutable
  before update of device_code, device_type on device
  for each row execute function prevent_device_code_mutation();
