create table source_field_mapping (
  tenant_id uuid not null,
  mapping_id uuid not null,
  source_system_id uuid not null,
  source_field varchar(256) not null check (length(trim(source_field)) >= 1),
  target_entity varchar(128) not null check (length(trim(target_entity)) >= 2),
  target_field varchar(256) not null check (length(trim(target_field)) >= 1),
  status varchar(16) not null check (status in ('ACTIVE', 'INACTIVE')),
  registered_by uuid not null,
  registered_at timestamptz not null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  primary key (tenant_id, mapping_id),
  constraint source_field_mapping_unique
    unique (tenant_id, source_system_id, source_field, target_entity, target_field),
  foreign key (tenant_id, source_system_id) references source_system_inventory(tenant_id, source_system_id),
  foreign key (tenant_id, registered_by) references app_user(tenant_id, user_id)
);

create index source_field_mapping_source_idx
  on source_field_mapping (tenant_id, source_system_id, target_entity, status);

create function prevent_source_field_mapping_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'source field mapping identity is immutable once registered';
end $$;

create trigger source_field_mapping_immutable
  before update of source_system_id, source_field, target_entity, target_field
  on source_field_mapping
  for each row execute function prevent_source_field_mapping_mutation();
