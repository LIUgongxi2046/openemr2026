create table inpatient_transfer (
  tenant_id uuid not null,
  transfer_id uuid not null,
  admission_id uuid not null,
  from_ward_id uuid not null,
  from_bed_id uuid not null,
  to_ward_id uuid not null,
  to_bed_id uuid not null,
  reason varchar(512) not null check (length(trim(reason)) > 0),
  status varchar(24) not null check (status in ('REQUESTED', 'COMPLETED', 'CANCELLED')),
  requested_by uuid not null,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  row_version bigint not null default 1 check (row_version > 0),
  primary key (tenant_id, transfer_id),
  foreign key (tenant_id, admission_id) references inpatient_admission(tenant_id, admission_id),
  foreign key (tenant_id, from_ward_id) references clinical_ward(tenant_id, ward_id),
  foreign key (tenant_id, from_bed_id) references clinical_bed(tenant_id, bed_id),
  foreign key (tenant_id, to_ward_id) references clinical_ward(tenant_id, ward_id),
  foreign key (tenant_id, to_bed_id) references clinical_bed(tenant_id, bed_id),
  foreign key (tenant_id, requested_by) references app_user(tenant_id, user_id),
  check ((status = 'COMPLETED') = (completed_at is not null)),
  check (from_bed_id <> to_bed_id)
);

create index inpatient_transfer_admission_idx
  on inpatient_transfer (tenant_id, admission_id, requested_at desc);
