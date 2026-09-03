create table integration_message (
  tenant_id uuid not null,
  message_id uuid not null,
  trace_id varchar(64) not null,
  connector_code varchar(128) not null,
  interface_code varchar(64) not null,
  direction varchar(16) not null check (direction in ('INBOUND', 'OUTBOUND')),
  business_object varchar(256) not null,
  business_key varchar(256),
  message_status varchar(16) not null check (message_status in ('PENDING', 'DELIVERED', 'RECONCILED', 'FAILED')),
  error_detail text,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  primary key (tenant_id, message_id)
);

create index integration_message_trace_idx on integration_message (tenant_id, trace_id);
create index integration_message_connector_idx on integration_message (tenant_id, connector_code, occurred_at desc);
create index integration_message_status_idx on integration_message (tenant_id, message_status, occurred_at desc);

create table integration_reconciliation (
  tenant_id uuid not null,
  reconciliation_id uuid not null,
  connector_code varchar(128) not null,
  window_start timestamptz not null,
  window_end timestamptz not null,
  sent_count bigint not null default 0 check (sent_count >= 0),
  delivered_count bigint not null default 0 check (delivered_count >= 0),
  error_count bigint not null default 0 check (error_count >= 0),
  pending_count bigint not null default 0 check (pending_count >= 0),
  status varchar(16) not null check (status in ('OPEN', 'RECONCILED')),
  reconciled_at timestamptz,
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  primary key (tenant_id, reconciliation_id),
  unique (tenant_id, connector_code, window_start, window_end)
);

create index integration_reconciliation_connector_idx
  on integration_reconciliation (tenant_id, connector_code, window_end desc);
