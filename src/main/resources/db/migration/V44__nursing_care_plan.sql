create table nursing_care_plan (
  tenant_id uuid not null,
  care_plan_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  admission_id uuid,
  nursing_problem varchar(2000) not null check (length(trim(nursing_problem)) >= 2),
  goal varchar(2000) not null check (length(trim(goal)) >= 2),
  intervention varchar(4000) not null check (length(trim(intervention)) >= 2),
  evaluation varchar(2000),
  priority varchar(8) not null check (priority in ('HIGH', 'MEDIUM', 'LOW')),
  status varchar(16) not null check (status in ('ACTIVE', 'COMPLETED', 'DISCONTINUED')),
  created_by uuid not null,
  completed_by uuid,
  completed_at timestamptz,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, care_plan_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, admission_id) references inpatient_admission(tenant_id, admission_id),
  foreign key (tenant_id, created_by) references app_user(tenant_id, user_id),
  foreign key (tenant_id, completed_by) references app_user(tenant_id, user_id),
  check ((status = 'COMPLETED') = (completed_at is not null))
);

create index nursing_care_plan_encounter_idx
  on nursing_care_plan (tenant_id, encounter_id, status, priority, created_at desc);

create function prevent_nursing_care_plan_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'nursing care plan content is immutable once created';
end $$;

create trigger nursing_care_plan_immutable
  before update of nursing_problem, goal, intervention, priority, created_by on nursing_care_plan
  for each row execute function prevent_nursing_care_plan_mutation();
