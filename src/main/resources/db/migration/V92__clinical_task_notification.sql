create table clinical_task_notification (
  tenant_id uuid not null,
  notification_id uuid not null,
  task_id uuid not null,
  recipient_user_id uuid not null,
  kind varchar(32) not null check (kind in ('CREATED', 'OVERDUE', 'ESCALATED', 'EXPIRED')),
  channel varchar(32) not null check (channel in ('IN_APP', 'OUTBOX')),
  status varchar(16) not null check (status in ('PENDING', 'DELIVERED', 'FAILED')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  delivered_at timestamptz,
  last_error varchar(1000),
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, notification_id),
  check ((status = 'DELIVERED') = (delivered_at is not null)),
  check ((status = 'FAILED') = (last_error is not null)),
  foreign key (tenant_id, task_id) references clinical_task(tenant_id, task_id),
  foreign key (tenant_id, recipient_user_id) references app_user(tenant_id, user_id)
);

create index clinical_task_notification_task_idx
  on clinical_task_notification (tenant_id, task_id, status, created_at desc, notification_id desc);

create function prevent_clinical_task_notification_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'clinical task notification identity is immutable';
end $$;

create trigger clinical_task_notification_immutable
  before update of task_id, recipient_user_id, kind, channel
  on clinical_task_notification
  for each row execute function prevent_clinical_task_notification_mutation();
