create table order_control_event (
  tenant_id uuid not null,
  order_control_event_id uuid not null,
  order_id uuid not null,
  action_type varchar(24) not null check (action_type in ('STOP_REQUESTED', 'CANCELLED')),
  previous_status varchar(24) not null,
  resulting_status varchar(24) not null,
  reason varchar(1000) not null check (length(trim(reason)) > 0),
  actor_user_id uuid not null,
  occurred_at timestamptz not null default now(),
  primary key (tenant_id, order_control_event_id),
  foreign key (tenant_id, order_id) references clinical_order(tenant_id, order_id),
  foreign key (tenant_id, actor_user_id) references app_user(tenant_id, user_id)
);

create index order_control_event_order_idx
  on order_control_event (tenant_id, order_id, occurred_at);

create function prevent_order_control_event_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'order control events are immutable';
end $$;

create trigger order_control_event_immutable
  before update or delete on order_control_event
  for each row execute function prevent_order_control_event_mutation();

