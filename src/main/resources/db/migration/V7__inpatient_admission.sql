alter table encounter
  add constraint encounter_tenant_encounter_patient_key unique (tenant_id, encounter_id, patient_id);

create table clinical_ward (
  tenant_id uuid not null,
  facility_id uuid not null,
  ward_id uuid not null,
  ward_code varchar(96) not null,
  display_name varchar(256) not null,
  status varchar(24) not null check (status in ('ACTIVE', 'INACTIVE')),
  primary key (tenant_id, ward_id),
  unique (tenant_id, facility_id, ward_code),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id)
);

create table clinical_bed (
  tenant_id uuid not null,
  bed_id uuid not null,
  ward_id uuid not null,
  bed_label varchar(64) not null,
  status varchar(24) not null check (status in ('ACTIVE', 'INACTIVE', 'MAINTENANCE')),
  primary key (tenant_id, bed_id),
  unique (tenant_id, ward_id, bed_label),
  foreign key (tenant_id, ward_id) references clinical_ward(tenant_id, ward_id)
);

create table ward_role_scope (
  tenant_id uuid not null,
  ward_id uuid not null,
  role_assignment_id uuid not null,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  primary key (tenant_id, ward_id, role_assignment_id),
  foreign key (tenant_id, ward_id) references clinical_ward(tenant_id, ward_id),
  foreign key (tenant_id, role_assignment_id) references role_assignment(tenant_id, role_assignment_id),
  check (valid_until is null or valid_until > valid_from)
);

create table inpatient_admission (
  tenant_id uuid not null,
  admission_id uuid not null,
  encounter_id uuid not null,
  patient_id uuid not null,
  facility_id uuid not null,
  ward_id uuid not null,
  current_bed_id uuid not null,
  attending_user_id uuid not null,
  status varchar(32) not null
    check (status in ('ADMITTED', 'TRANSFER_PENDING', 'DISCHARGE_PENDING', 'DISCHARGED', 'CANCELLED')),
  admitted_at timestamptz not null,
  discharged_at timestamptz,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, admission_id),
  unique (tenant_id, encounter_id),
  foreign key (tenant_id, encounter_id, patient_id)
    references encounter(tenant_id, encounter_id, patient_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, ward_id) references clinical_ward(tenant_id, ward_id),
  foreign key (tenant_id, current_bed_id) references clinical_bed(tenant_id, bed_id),
  foreign key (tenant_id, attending_user_id) references app_user(tenant_id, user_id),
  check ((status = 'DISCHARGED') = (discharged_at is not null)),
  check (discharged_at is null or discharged_at >= admitted_at)
);

create table bed_occupancy (
  tenant_id uuid not null,
  bed_occupancy_id uuid not null,
  admission_id uuid not null,
  ward_id uuid not null,
  bed_id uuid not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  end_reason varchar(64),
  primary key (tenant_id, bed_occupancy_id),
  foreign key (tenant_id, admission_id) references inpatient_admission(tenant_id, admission_id),
  foreign key (tenant_id, ward_id) references clinical_ward(tenant_id, ward_id),
  foreign key (tenant_id, bed_id) references clinical_bed(tenant_id, bed_id),
  check (ended_at is null or ended_at >= started_at),
  check ((ended_at is null) = (end_reason is null))
);

create unique index bed_occupancy_active_bed_idx
  on bed_occupancy (tenant_id, bed_id) where ended_at is null;
create unique index bed_occupancy_active_admission_idx
  on bed_occupancy (tenant_id, admission_id) where ended_at is null;

create table inpatient_document_task (
  tenant_id uuid not null,
  task_id uuid not null,
  admission_id uuid not null,
  document_type_code varchar(128) not null,
  task_state varchar(24) not null
    check (task_state in ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'WAIVED', 'OVERDUE')),
  due_at timestamptz not null,
  completed_document_id uuid,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, task_id),
  unique (tenant_id, admission_id, document_type_code),
  foreign key (tenant_id, admission_id) references inpatient_admission(tenant_id, admission_id),
  foreign key (tenant_id, completed_document_id) references clinical_document(tenant_id, document_id),
  check ((task_state = 'COMPLETED') = (completed_document_id is not null))
);

create index inpatient_admission_ward_idx
  on inpatient_admission (tenant_id, ward_id, status, admitted_at);
create index inpatient_document_task_due_idx
  on inpatient_document_task (tenant_id, task_state, due_at)
  where task_state in ('PENDING', 'IN_PROGRESS', 'OVERDUE');
