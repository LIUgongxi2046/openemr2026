create table outpatient_followup (
  tenant_id uuid not null,
  followup_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  followup_type varchar(24) not null,
  content varchar(2000) not null,
  outcome varchar(2000),
  status varchar(24) not null default 'PENDING',
  due_at timestamptz,
  completed_at timestamptz,
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, followup_id),
  foreign key (tenant_id) references tenant(tenant_id),
  constraint outpatient_followup_type_check check (followup_type in ('EDUCATION', 'REVISIT', 'FOLLOWUP')),
  constraint outpatient_followup_status_check check (status in ('PENDING', 'COMPLETED')),
  constraint outpatient_followup_row_version_check check (row_version > 0)
);

create index outpatient_followup_patient_idx on outpatient_followup (tenant_id, patient_id, due_at);
