create table agent_registry (
  tenant_id uuid not null,
  agent_registry_id uuid not null,
  agent_code varchar(128) not null,
  agent_name varchar(256) not null check (length(trim(agent_name)) >= 2),
  agent_version varchar(64) not null check (length(trim(agent_version)) >= 1),
  status varchar(16) not null check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, agent_registry_id),
  unique (tenant_id, agent_code)
);

create index agent_registry_status_idx
  on agent_registry (tenant_id, status, agent_code);

create function prevent_agent_registry_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'agent registry code, name and version are immutable once registered';
end $$;

create trigger agent_registry_immutable
  before update of agent_code, agent_name, agent_version on agent_registry
  for each row execute function prevent_agent_registry_mutation();
