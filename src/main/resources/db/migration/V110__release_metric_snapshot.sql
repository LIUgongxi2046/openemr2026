create table release_metric_snapshot (
  tenant_id uuid not null,
  snapshot_id uuid not null,
  metric_type varchar(24) not null check (metric_type in ('STARS', 'DOWNLOADS', 'ACTIVE_INSTALLS')),
  metric_value integer not null,
  source varchar(64) not null check (length(trim(source)) >= 2),
  snapshot_date date not null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  primary key (tenant_id, snapshot_id),
  constraint release_metric_value_check check (metric_value >= 0),
  unique (tenant_id, metric_type, source, snapshot_date)
);

create index release_metric_type_idx
  on release_metric_snapshot (tenant_id, metric_type, snapshot_date desc, snapshot_id desc);

create function prevent_release_metric_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'release metric snapshot is immutable once recorded';
end $$;

create trigger release_metric_immutable
  before update of metric_type, metric_value, source, snapshot_date
  on release_metric_snapshot
  for each row execute function prevent_release_metric_mutation();
