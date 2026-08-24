create table agent_dependency (
  tenant_id uuid not null,
  agent_dependency_id uuid not null,
  agent_registry_id uuid not null,
  dependency_type varchar(16) not null check (dependency_type in ('SKILL', 'TOOL')),
  dependency_code varchar(128) not null check (length(trim(dependency_code)) >= 2),
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, agent_dependency_id),
  unique (tenant_id, agent_registry_id, dependency_type, dependency_code),
  foreign key (tenant_id, agent_registry_id) references agent_registry(tenant_id, agent_registry_id)
);

create index agent_dependency_agent_idx
  on agent_dependency (tenant_id, agent_registry_id, dependency_type, dependency_code);

create function prevent_agent_dependency_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'agent dependency identity is immutable once declared';
end $$;

create trigger agent_dependency_immutable
  before update of agent_registry_id, dependency_type, dependency_code
  on agent_dependency
  for each row execute function prevent_agent_dependency_mutation();
