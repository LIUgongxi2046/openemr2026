create table clinical_task_in_app_delivery (
  tenant_id uuid not null,
  delivery_id uuid not null,
  notification_id uuid not null,
  recipient_user_id uuid not null,
  delivered_at timestamptz not null default now(),
  read_at timestamptz,
  acknowledged_at timestamptz,
  row_version bigint not null default 1 check (row_version > 0),
  primary key (tenant_id, delivery_id),
  unique (tenant_id, notification_id),
  foreign key (tenant_id, notification_id)
    references clinical_task_notification(tenant_id, notification_id),
  foreign key (tenant_id, recipient_user_id)
    references app_user(tenant_id, user_id),
  check (acknowledged_at is null or read_at is not null),
  check (read_at is null or read_at >= delivered_at),
  check (acknowledged_at is null or acknowledged_at >= read_at)
);

create index clinical_task_in_app_recipient_idx
  on clinical_task_in_app_delivery(tenant_id, recipient_user_id, acknowledged_at, delivered_at desc);

create function protect_clinical_task_in_app_delivery_identity() returns trigger language plpgsql as $$
begin
  if new.tenant_id <> old.tenant_id
     or new.delivery_id <> old.delivery_id
     or new.notification_id <> old.notification_id
     or new.recipient_user_id <> old.recipient_user_id
     or new.delivered_at <> old.delivered_at then
    raise exception 'clinical task in-app delivery identity is immutable' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger clinical_task_in_app_delivery_identity_immutable
  before update or delete on clinical_task_in_app_delivery
  for each row execute function protect_clinical_task_in_app_delivery_identity();
