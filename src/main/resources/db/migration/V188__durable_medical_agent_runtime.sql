alter table medical_agent_run
  add column attempt integer not null default 0 check (attempt >= 0),
  add column max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  add column available_at timestamptz not null default now(),
  add column worker_lease_owner uuid,
  add column worker_lease_until timestamptz,
  add column last_heartbeat_at timestamptz,
  add column cancel_requested_at timestamptz,
  add column cancel_requested_by uuid,
  add column failure_code varchar(128),
  add constraint medical_agent_run_worker_lease_pair check (
    (worker_lease_owner is null) = (worker_lease_until is null)
  ),
  add constraint medical_agent_run_cancel_actor_fk foreign key (tenant_id, cancel_requested_by)
    references app_user(tenant_id, user_id);

alter table agent_run_budget_consumption
  add column attempt integer not null default 1 check (attempt > 0),
  drop constraint agent_run_budget_consumption_unique,
  add constraint agent_run_budget_consumption_attempt_unique
    unique (tenant_id, run_id, budget_id, attempt);

create index medical_agent_run_worker_queue_idx
  on medical_agent_run(state, available_at, created_at, run_id)
  where state = 'QUEUED';

create index medical_agent_run_worker_lease_idx
  on medical_agent_run(state, worker_lease_until)
  where state = 'RUNNING';
