create table agent_run_budget_consumption (
  tenant_id uuid not null,
  consumption_id uuid not null,
  budget_id uuid not null,
  run_id uuid not null,
  tokens_consumed bigint not null,
  duration_seconds bigint not null,
  recorded_by uuid not null,
  recorded_at timestamptz not null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  primary key (tenant_id, consumption_id),
  constraint agent_run_budget_consumption_unique unique (tenant_id, run_id, budget_id),
  constraint agent_run_budget_consumption_tokens_check check (tokens_consumed >= 0),
  constraint agent_run_budget_consumption_duration_check check (duration_seconds >= 0),
  foreign key (tenant_id, budget_id) references agent_run_budget(tenant_id, budget_id),
  foreign key (tenant_id, recorded_by) references app_user(tenant_id, user_id)
);

create index agent_run_budget_consumption_budget_idx
  on agent_run_budget_consumption (tenant_id, budget_id, recorded_at desc, consumption_id desc);

create function prevent_agent_run_budget_consumption_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'agent run budget consumption is immutable once recorded';
end $$;

create trigger agent_run_budget_consumption_immutable
  before update or delete on agent_run_budget_consumption
  for each row execute function prevent_agent_run_budget_consumption_mutation();
