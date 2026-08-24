create table data_quality_evaluation (
  tenant_id uuid not null,
  data_quality_evaluation_id uuid not null,
  data_quality_rule_id uuid not null,
  target_entity_id uuid not null,
  measured_value numeric(5,4) not null,
  threshold numeric(5,4) not null,
  status varchar(16) not null,
  evaluated_at timestamptz not null,
  evaluated_by uuid not null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  primary key (tenant_id, data_quality_evaluation_id),
  constraint data_quality_evaluation_measured_value_check check (measured_value between 0 and 1),
  constraint data_quality_evaluation_threshold_check check (threshold between 0 and 1),
  constraint data_quality_evaluation_status_check check (status in ('PASSED', 'FAILED')),
  constraint data_quality_evaluation_passed_check check ((status = 'PASSED') = (measured_value >= threshold)),
  foreign key (tenant_id, data_quality_rule_id)
    references data_quality_rule(tenant_id, data_quality_rule_id),
  foreign key (tenant_id, evaluated_by) references app_user(tenant_id, user_id)
);

create index data_quality_evaluation_rule_idx
  on data_quality_evaluation (tenant_id, data_quality_rule_id, evaluated_at desc, data_quality_evaluation_id desc);

create function prevent_data_quality_evaluation_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'data quality evaluation is immutable once recorded';
end $$;

create trigger data_quality_evaluation_immutable
  before update or delete on data_quality_evaluation
  for each row execute function prevent_data_quality_evaluation_mutation();
