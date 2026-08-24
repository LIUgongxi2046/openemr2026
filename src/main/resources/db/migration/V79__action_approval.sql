create table action_approval (
  tenant_id uuid not null,
  action_approval_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  action_type varchar(32) not null
    check (action_type in ('ORDER_MEDICATION', 'ORDER_LAB', 'ORDER_IMAGING', 'CREATE_DOCUMENT', 'OTHER')),
  proposed_action_summary varchar(1000) not null check (length(trim(proposed_action_summary)) >= 2),
  proposed_by uuid not null,
  proposed_at timestamptz not null,
  status varchar(16) not null check (status in ('PROPOSED', 'APPROVED', 'REJECTED')),
  decided_by uuid,
  decided_at timestamptz,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, action_approval_id),
  check (decided_by is null or decided_by <> proposed_by),
  check ((status in ('APPROVED', 'REJECTED')) = (decided_at is not null)),
  check ((status in ('APPROVED', 'REJECTED')) = (decided_by is not null)),
  check (decided_at is null or decided_at >= proposed_at),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, proposed_by) references app_user(tenant_id, user_id),
  foreign key (tenant_id, decided_by) references app_user(tenant_id, user_id)
);

create index action_approval_patient_idx
  on action_approval (tenant_id, patient_id, status, proposed_at desc, action_approval_id desc);

create function prevent_action_approval_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'action approval proposal is immutable once created';
end $$;

create trigger action_approval_immutable
  before update of patient_id, encounter_id, facility_id, action_type,
    proposed_action_summary, proposed_by, proposed_at on action_approval
  for each row execute function prevent_action_approval_mutation();
