create table tool_registry (
  tenant_id uuid not null,
  tool_registry_id uuid not null,
  tool_code varchar(128) not null,
  tool_name varchar(256) not null check (length(trim(tool_name)) >= 2),
  tool_version varchar(64) not null check (length(trim(tool_version)) >= 1),
  tool_type varchar(24) not null check (tool_type in ('API', 'FUNCTION', 'DATABASE_QUERY', 'OTHER')),
  status varchar(16) not null check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, tool_registry_id),
  unique (tenant_id, tool_code)
);

create index tool_registry_status_idx
  on tool_registry (tenant_id, status, tool_code);

create function prevent_tool_registry_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'tool registry code, name, version and type are immutable once registered';
end $$;

create trigger tool_registry_immutable
  before update of tool_code, tool_name, tool_version, tool_type on tool_registry
  for each row execute function prevent_tool_registry_mutation();
