alter table appointment
  add column check_in_at timestamptz;

create table waiting_queue_entry (
  tenant_id uuid not null,
  waiting_queue_entry_id uuid not null,
  appointment_id uuid not null,
  facility_id uuid not null,
  queue_date date not null,
  sequence_no integer not null check (sequence_no > 0),
  status varchar(16) not null check (status in ('WAITING', 'CALLED', 'IN_CONSULTATION', 'COMPLETED', 'SKIPPED')),
  called_at timestamptz,
  called_by uuid,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, waiting_queue_entry_id),
  unique (tenant_id, appointment_id),
  unique (tenant_id, facility_id, queue_date, sequence_no),
  foreign key (tenant_id, appointment_id) references appointment(tenant_id, appointment_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, called_by) references app_user(tenant_id, user_id)
);

create index waiting_queue_facility_date_idx
  on waiting_queue_entry (tenant_id, facility_id, queue_date, status, sequence_no);
