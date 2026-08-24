create table schedule_slot (
  tenant_id uuid not null,
  schedule_slot_id uuid not null,
  organization_id uuid not null,
  facility_id uuid not null,
  department_id uuid,
  visit_type varchar(16) not null check (visit_type in ('OUTPATIENT', 'EMERGENCY')),
  slot_date date not null,
  start_time time not null,
  end_time time not null,
  total_capacity integer not null check (total_capacity > 0),
  booked_count integer not null default 0 check (booked_count between 0 and total_capacity),
  status varchar(16) not null check (status in ('OPEN', 'CLOSED', 'CANCELLED')),
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, schedule_slot_id),
  foreign key (tenant_id, organization_id) references organization(tenant_id, organization_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, facility_id, department_id)
    references clinical_department(tenant_id, facility_id, department_id),
  check (end_time > start_time)
);

create unique index schedule_slot_unique_window_idx
  on schedule_slot (tenant_id, facility_id, department_id, visit_type, slot_date, start_time, end_time)
  where status <> 'CANCELLED';

create table appointment (
  tenant_id uuid not null,
  appointment_id uuid not null,
  schedule_slot_id uuid not null,
  patient_id uuid not null,
  organization_id uuid not null,
  facility_id uuid not null,
  visit_type varchar(16) not null check (visit_type in ('OUTPATIENT', 'EMERGENCY')),
  source varchar(16) not null check (source in ('APPOINTMENT', 'WALK_IN', 'EMERGENCY')),
  status varchar(16) not null check (status in ('BOOKED', 'CHECKED_IN', 'CANCELLED', 'NO_SHOW', 'COMPLETED')),
  booked_at timestamptz not null,
  cancelled_at timestamptz,
  cancel_reason varchar(1000),
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, appointment_id),
  foreign key (tenant_id, schedule_slot_id) references schedule_slot(tenant_id, schedule_slot_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, organization_id) references organization(tenant_id, organization_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  check (cancelled_at is null or status = 'CANCELLED')
);

create index appointment_patient_idx
  on appointment (tenant_id, patient_id, status, booked_at desc);
create index appointment_slot_idx
  on appointment (tenant_id, schedule_slot_id, status);

create table appointment_event (
  tenant_id uuid not null,
  appointment_event_id uuid not null,
  appointment_id uuid not null,
  event_type varchar(16) not null check (
    event_type in ('BOOKED', 'CANCELLED', 'CHECKED_IN', 'COMPLETED', 'NO_SHOW')),
  previous_status varchar(16),
  resulting_status varchar(16) not null,
  actor_user_id uuid not null,
  reason varchar(1000),
  occurred_at timestamptz not null default now(),
  primary key (tenant_id, appointment_event_id),
  foreign key (tenant_id, appointment_id) references appointment(tenant_id, appointment_id),
  foreign key (tenant_id, actor_user_id) references app_user(tenant_id, user_id)
);

create index appointment_event_appointment_idx
  on appointment_event (tenant_id, appointment_id, occurred_at);

create function prevent_appointment_event_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'appointment events are immutable';
end $$;

create trigger appointment_event_immutable
  before update or delete on appointment_event
  for each row execute function prevent_appointment_event_mutation();
