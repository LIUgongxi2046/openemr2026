create table model_evaluation (
  tenant_id uuid not null,
  model_evaluation_id uuid not null,
  model_deployment_id uuid not null,
  eval_name varchar(256) not null check (length(trim(eval_name)) >= 2),
  score numeric(5,4) not null check (score between 0 and 1),
  threshold numeric(5,4) not null check (threshold between 0 and 1),
  status varchar(16) not null check (status in ('PASSED', 'FAILED')),
  evaluated_at timestamptz not null,
  evaluated_by uuid not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, model_evaluation_id),
  check ((status = 'PASSED') = (score >= threshold)),
  foreign key (tenant_id, model_deployment_id) references model_deployment(tenant_id, model_deployment_id),
  foreign key (tenant_id, evaluated_by) references app_user(tenant_id, user_id)
);

create index model_evaluation_model_idx
  on model_evaluation (tenant_id, model_deployment_id, evaluated_at desc, model_evaluation_id desc);

create function prevent_model_evaluation_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'model evaluation is immutable once recorded';
end $$;

create trigger model_evaluation_immutable
  before update or delete on model_evaluation
  for each row execute function prevent_model_evaluation_mutation();
