create table source_system_inventory (
  tenant_id uuid not null,
  source_system_id uuid not null,
  source_code varchar(64) not null check (length(trim(source_code)) >= 2),
  display_name varchar(256) not null check (length(trim(display_name)) >= 2),
  system_type varchar(32) not null check (system_type in ('EMR', 'LIS', 'PACS', 'PHARMACY', 'BILLING', 'OTHER')),
  connection_status varchar(16) not null
    check (connection_status in ('REGISTERED', 'CONFIGURED', 'ACTIVE', 'RETIRED')),
  registered_by uuid not null,
  registered_at timestamptz not null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  primary key (tenant_id, source_system_id),
  constraint source_system_inventory_source_code_unique unique (tenant_id, source_code),
  foreign key (tenant_id, registered_by) references app_user(tenant_id, user_id)
);

create index source_system_inventory_status_idx
  on source_system_inventory (tenant_id, connection_status, source_code);

create function prevent_source_system_inventory_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'source system inventory identity is immutable once registered';
end $$;

create trigger source_system_inventory_immutable
  before update of source_code, system_type, registered_by, registered_at
  on source_system_inventory
  for each row execute function prevent_source_system_inventory_mutation();
