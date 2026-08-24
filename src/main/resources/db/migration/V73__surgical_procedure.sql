create table surgical_procedure (
  tenant_id uuid not null,
  surgical_procedure_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  procedure_name varchar(256) not null check (length(trim(procedure_name)) >= 2),
  body_site varchar(32) not null check (body_site in ('HEAD', 'NECK', 'CHEST', 'ABDOMEN', 'PELVIS', 'SPINE', 'UPPER_EXTREMITY', 'LOWER_EXTREMITY', 'OTHER')),
  laterality varchar(16) not null check (laterality in ('NONE', 'LEFT', 'RIGHT', 'BILATERAL')),
  surgeon_id uuid not null,
  anesthesiologist_id uuid not null,
  status varchar(24) not null check (status in ('SCHEDULED', 'TIME_OUT_COMPLETED', 'COMPLETED')),
  scheduled_at timestamptz not null,
  time_out_at timestamptz,
  completed_at timestamptz,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, surgical_procedure_id),
  check (surgeon_id <> anesthesiologist_id),
  check (body_site not in ('UPPER_EXTREMITY', 'LOWER_EXTREMITY') or laterality <> 'NONE'),
  check ((status in ('TIME_OUT_COMPLETED', 'COMPLETED')) = (time_out_at is not null)),
  check ((status = 'COMPLETED') = (completed_at is not null)),
  check (time_out_at is null or time_out_at >= scheduled_at),
  check (completed_at is null or completed_at >= time_out_at),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, surgeon_id) references app_user(tenant_id, user_id),
  foreign key (tenant_id, anesthesiologist_id) references app_user(tenant_id, user_id)
);

create index surgical_procedure_patient_idx
  on surgical_procedure (tenant_id, patient_id, status, scheduled_at desc, surgical_procedure_id desc);

create function prevent_surgical_procedure_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'surgical procedure identity is immutable once created';
end $$;

create trigger surgical_procedure_immutable
  before update of patient_id, encounter_id, facility_id, procedure_name, body_site,
    laterality, surgeon_id, anesthesiologist_id, scheduled_at on surgical_procedure
  for each row execute function prevent_surgical_procedure_mutation();
