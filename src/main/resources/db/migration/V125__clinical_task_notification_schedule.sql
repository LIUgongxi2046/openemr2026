alter table clinical_task_notification
  add column scheduled_at timestamptz not null default now();

create index clinical_task_notification_dispatch_idx
  on clinical_task_notification (tenant_id, status, scheduled_at, notification_id);
