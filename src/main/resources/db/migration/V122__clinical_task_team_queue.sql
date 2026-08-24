create table clinical_task_team_queue (
  tenant_id uuid not null,
  queue_id uuid not null,
  facility_id uuid not null,
  department_id uuid not null,
  clinical_task_id uuid not null,
  queue_status varchar(16) not null check (queue_status in ('ENQUEUED', 'CLAIMED', 'COMPLETED', 'WITHDRAWN')),
  enqueued_by uuid not null,
  enqueued_at timestamptz not null,
  claimed_by uuid,
  claimed_at timestamptz,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  primary key (tenant_id, queue_id),
  constraint clinical_task_team_queue_claim_check
    check ((queue_status in ('CLAIMED', 'COMPLETED')) = (claimed_by is not null and claimed_at is not null)),
  foreign key (tenant_id, facility_id, department_id)
    references clinical_department(tenant_id, facility_id, department_id),
  foreign key (tenant_id, clinical_task_id) references clinical_task(tenant_id, task_id),
  foreign key (tenant_id, enqueued_by) references app_user(tenant_id, user_id),
  foreign key (tenant_id, claimed_by) references app_user(tenant_id, user_id)
);

create unique index clinical_task_team_queue_active_idx
  on clinical_task_team_queue (tenant_id, department_id, clinical_task_id)
  where queue_status in ('ENQUEUED', 'CLAIMED');

create index clinical_task_team_queue_department_idx
  on clinical_task_team_queue (tenant_id, department_id, queue_status, enqueued_at desc, queue_id desc);

create function prevent_clinical_task_team_queue_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'clinical task team queue identity is immutable once enqueued';
end $$;

create trigger clinical_task_team_queue_immutable
  before update of clinical_task_id, department_id, facility_id, enqueued_by, enqueued_at
  on clinical_task_team_queue
  for each row execute function prevent_clinical_task_team_queue_mutation();
