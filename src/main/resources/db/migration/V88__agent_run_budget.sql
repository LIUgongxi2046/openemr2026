create table agent_run_budget (
  tenant_id uuid not null,
  budget_id uuid not null,
  budget_code varchar(128) not null,
  budget_name varchar(256) not null check (length(trim(budget_name)) >= 2),
  max_tokens bigint not null check (max_tokens > 0),
  max_duration_seconds integer not null check (max_duration_seconds > 0),
  status varchar(16) not null check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, budget_id),
  unique (tenant_id, budget_code)
);

create index agent_run_budget_status_idx
  on agent_run_budget (tenant_id, status, budget_code);

create function prevent_agent_run_budget_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'agent run budget code and limits are immutable once defined';
end $$;

create trigger agent_run_budget_immutable
  before update of budget_code, max_tokens, max_duration_seconds on agent_run_budget
  for each row execute function prevent_agent_run_budget_mutation();
