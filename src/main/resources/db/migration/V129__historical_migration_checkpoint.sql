create table historical_migration_checkpoint (
  tenant_id uuid not null,
  checkpoint_id uuid not null,
  batch_id uuid not null,
  processed_records bigint not null check (processed_records >= 0),
  last_source_key varchar(512),
  checkpointed_by uuid not null,
  checkpointed_at timestamptz not null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  primary key (tenant_id, checkpoint_id),
  foreign key (tenant_id, batch_id) references historical_migration_batch(tenant_id, batch_id),
  foreign key (tenant_id, checkpointed_by) references app_user(tenant_id, user_id)
);

create index historical_migration_checkpoint_batch_idx
  on historical_migration_checkpoint (tenant_id, batch_id, checkpointed_at desc, checkpoint_id desc);

create function prevent_historical_migration_checkpoint_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'historical migration checkpoint is immutable once recorded';
end $$;

create trigger historical_migration_checkpoint_immutable
  before update or delete on historical_migration_checkpoint
  for each row execute function prevent_historical_migration_checkpoint_mutation();
