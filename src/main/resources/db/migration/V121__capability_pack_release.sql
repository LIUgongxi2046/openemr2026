create table capability_pack_release (
  tenant_id uuid not null,
  release_id uuid not null,
  capability_pack_id uuid not null,
  release_version varchar(64) not null,
  lifecycle_status varchar(16) not null
    check (lifecycle_status in ('DRAFT', 'CANARY', 'ACTIVE', 'RETIRED', 'ROLLED_BACK')),
  canary_started_at timestamptz,
  promoted_at timestamptz,
  retired_at timestamptz,
  rollback_reason varchar(1000),
  released_by uuid not null,
  released_at timestamptz not null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  primary key (tenant_id, release_id),
  constraint capability_pack_release_version_check check (length(trim(release_version)) >= 2),
  constraint capability_pack_release_canary_check
    check ((lifecycle_status in ('CANARY', 'ACTIVE', 'RETIRED', 'ROLLED_BACK')) = (canary_started_at is not null)),
  constraint capability_pack_release_promote_check
    check ((lifecycle_status in ('ACTIVE', 'RETIRED')) = (promoted_at is not null)),
  constraint capability_pack_release_retire_check
    check ((lifecycle_status = 'RETIRED') = (retired_at is not null)),
  constraint capability_pack_release_rollback_check
    check ((lifecycle_status = 'ROLLED_BACK') = (rollback_reason is not null and length(trim(rollback_reason)) >= 2)),
  foreign key (tenant_id, capability_pack_id) references capability_pack(tenant_id, capability_pack_id),
  foreign key (tenant_id, released_by) references app_user(tenant_id, user_id)
);

create unique index capability_pack_release_one_active_idx
  on capability_pack_release (tenant_id, capability_pack_id) where lifecycle_status = 'ACTIVE';

create index capability_pack_release_pack_idx
  on capability_pack_release (tenant_id, capability_pack_id, released_at desc, release_id desc);

create function prevent_capability_pack_release_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'capability pack release identity is immutable once created';
end $$;

create trigger capability_pack_release_immutable
  before update of capability_pack_id, release_version, released_by, released_at
  on capability_pack_release
  for each row execute function prevent_capability_pack_release_mutation();
