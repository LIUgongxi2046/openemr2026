create table metric_snapshot (
  tenant_id uuid not null,
  snapshot_id uuid not null,
  metric_type varchar(64) not null,
  metric_name varchar(128) not null,
  metric_value numeric not null,
  unit varchar(32),
  dimension jsonb not null default '{}'::jsonb,
  period date,
  status varchar(24) not null default 'DRAFT',
  row_version bigint not null default 1,
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (tenant_id, snapshot_id),
  foreign key (tenant_id) references tenant(tenant_id),
  constraint metric_snapshot_status_check check (status in ('DRAFT', 'FINAL')),
  constraint metric_snapshot_row_version_check check (row_version > 0)
);

create index metric_snapshot_type_idx on metric_snapshot (tenant_id, metric_type, computed_at desc);
