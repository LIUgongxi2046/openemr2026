create table skill_registry (
  tenant_id uuid not null,
  skill_registry_id uuid not null,
  skill_code varchar(128) not null,
  skill_name varchar(256) not null check (length(trim(skill_name)) >= 2),
  skill_version varchar(64) not null check (length(trim(skill_version)) >= 1),
  status varchar(16) not null check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, skill_registry_id),
  unique (tenant_id, skill_code)
);

create index skill_registry_status_idx
  on skill_registry (tenant_id, status, skill_code);

create function prevent_skill_registry_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'skill registry code, name and version are immutable once registered';
end $$;

create trigger skill_registry_immutable
  before update of skill_code, skill_name, skill_version on skill_registry
  for each row execute function prevent_skill_registry_mutation();
