alter table historical_migration_batch
  add column source_system_id uuid;

update historical_migration_batch b
set source_system_id = s.source_system_id
from source_system_inventory s
where b.tenant_id = s.tenant_id
  and b.source_system = s.source_code
  and b.source_system_id is null;

alter table historical_migration_batch
  add constraint historical_migration_batch_source_fk
  foreign key (tenant_id, source_system_id)
  references source_system_inventory(tenant_id, source_system_id);

create index historical_migration_batch_source_id_idx
  on historical_migration_batch (tenant_id, source_system_id, started_at desc);

create table historical_migration_reconciliation_item (
  tenant_id uuid not null,
  reconciliation_item_id uuid not null,
  batch_id uuid not null,
  candidate_id uuid not null,
  source_record_hash varchar(64) not null check (length(source_record_hash) = 64),
  target_patient_id uuid,
  validation_status varchar(16) not null check (validation_status in ('MATCHED', 'MISMATCH')),
  validation_code varchar(64) not null,
  reconciled_by uuid not null,
  reconciled_at timestamptz not null default now(),
  primary key (tenant_id, reconciliation_item_id),
  constraint historical_migration_reconciliation_candidate_unique
    unique (tenant_id, batch_id, candidate_id),
  foreign key (tenant_id, batch_id)
    references historical_migration_batch(tenant_id, batch_id),
  foreign key (tenant_id, candidate_id)
    references source_patient_match_candidate(tenant_id, candidate_id),
  foreign key (tenant_id, target_patient_id)
    references patient(tenant_id, patient_id),
  foreign key (tenant_id, reconciled_by)
    references app_user(tenant_id, user_id)
);

create index historical_migration_reconciliation_batch_idx
  on historical_migration_reconciliation_item
  (tenant_id, batch_id, validation_status, reconciled_at desc);

create function prevent_historical_migration_reconciliation_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'historical migration reconciliation evidence is immutable';
end $$;

create trigger historical_migration_reconciliation_immutable
  before update or delete on historical_migration_reconciliation_item
  for each row execute function prevent_historical_migration_reconciliation_mutation();
