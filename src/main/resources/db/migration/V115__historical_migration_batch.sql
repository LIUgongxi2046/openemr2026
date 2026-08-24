create table historical_migration_batch (
  tenant_id uuid not null,
  batch_id uuid not null,
  source_system varchar(64) not null check (length(trim(source_system)) >= 2),
  batch_status varchar(16) not null check (batch_status in ('TRIAL', 'RECONCILED', 'SWITCHED', 'ROLLED_BACK')),
  record_count integer not null,
  mismatch_count integer not null default 0,
  started_at timestamptz not null,
  completed_at timestamptz,
  created_by uuid not null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  primary key (tenant_id, batch_id),
  constraint historical_migration_record_count_check check (record_count >= 0),
  constraint historical_migration_mismatch_count_check check (mismatch_count >= 0),
  constraint historical_migration_switch_check check (batch_status <> 'SWITCHED' or mismatch_count = 0),
  constraint historical_migration_completed_check
    check ((batch_status in ('RECONCILED', 'SWITCHED', 'ROLLED_BACK')) = (completed_at is not null)),
  foreign key (tenant_id, created_by) references app_user(tenant_id, user_id)
);

create index historical_migration_source_idx
  on historical_migration_batch (tenant_id, source_system, started_at desc, batch_id desc);

create function prevent_historical_migration_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'historical migration batch identity is immutable once started';
end $$;

create trigger historical_migration_immutable
  before update of source_system, record_count, started_at, created_by
  on historical_migration_batch
  for each row execute function prevent_historical_migration_mutation();
