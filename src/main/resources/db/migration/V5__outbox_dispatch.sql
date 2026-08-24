alter table outbox_event
  add column dispatch_state varchar(24) not null default 'PENDING',
  add column lease_owner uuid,
  add column lease_until timestamptz,
  add column fencing_token bigint not null default 0,
  add column dead_lettered_at timestamptz,
  add constraint outbox_event_dispatch_state_check
    check (dispatch_state in ('PENDING', 'IN_FLIGHT', 'PUBLISHED', 'DEAD_LETTER')),
  add constraint outbox_event_fencing_token_check check (fencing_token >= 0),
  add constraint outbox_event_lease_pair_check
    check ((lease_owner is null) = (lease_until is null));

update outbox_event
set dispatch_state = 'PUBLISHED'
where published_at is not null;

alter table outbox_event
  add constraint outbox_event_publish_state_check
    check ((published_at is null) = (dispatch_state <> 'PUBLISHED')),
  add constraint outbox_event_dead_letter_state_check
    check ((dead_lettered_at is null) = (dispatch_state <> 'DEAD_LETTER'));

drop index outbox_event_pending_idx;
create index outbox_event_dispatch_idx
  on outbox_event (dispatch_state, available_at, event_id)
  where published_at is null;

create table outbox_consumer_receipt (
  tenant_id uuid not null,
  event_id uuid not null,
  consumer_name varchar(128) not null,
  payload_hash char(64) not null,
  completed_at timestamptz not null default now(),
  primary key (tenant_id, event_id, consumer_name),
  foreign key (tenant_id, event_id) references outbox_event(tenant_id, event_id)
);

create table clinical_event_projection (
  tenant_id uuid not null,
  event_id uuid not null,
  aggregate_type varchar(96) not null,
  aggregate_id uuid not null,
  aggregate_version bigint not null,
  event_type varchar(128) not null,
  schema_version integer not null,
  payload jsonb not null,
  projected_at timestamptz not null default now(),
  primary key (tenant_id, event_id),
  foreign key (tenant_id, event_id) references outbox_event(tenant_id, event_id)
);

create index clinical_event_projection_aggregate_idx
  on clinical_event_projection (tenant_id, aggregate_type, aggregate_id, aggregate_version);

create table outbox_replay_audit (
  replay_audit_id uuid primary key,
  tenant_id uuid not null,
  event_id uuid not null,
  actor_user_id uuid not null,
  prior_attempt integer not null,
  reason varchar(500) not null,
  requested_at timestamptz not null default now(),
  foreign key (tenant_id, event_id) references outbox_event(tenant_id, event_id),
  foreign key (tenant_id, actor_user_id) references app_user(tenant_id, user_id),
  check (length(trim(reason)) >= 8)
);

create index outbox_replay_audit_event_idx
  on outbox_replay_audit (tenant_id, event_id, requested_at desc);
