create table research_project (
  tenant_id uuid not null,
  project_id uuid not null,
  project_code varchar(128) not null,
  display_name varchar(256) not null check (length(trim(display_name)) >= 2),
  project_type varchar(32) not null check (project_type in ('OBSERVATIONAL', 'RETROSPECTIVE', 'INTERVENTIONAL')),
  principal_investigator varchar(128) not null,
  registry_number varchar(128),
  ethics_approval varchar(128),
  approved_purpose text not null,
  data_scope text[] not null default '{}',
  member_count integer not null default 1 check (member_count >= 1),
  expires_at date,
  status varchar(16) not null check (status in ('ACTIVE', 'INACTIVE')),
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, project_id),
  unique (tenant_id, project_code)
);

create index research_project_status_idx on research_project (tenant_id, status, project_code);

create function prevent_research_project_code_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'research project identity code is immutable once defined';
end $$;

create trigger research_project_code_immutable
  before update of project_code, project_type, approved_purpose on research_project
  for each row execute function prevent_research_project_code_mutation();
