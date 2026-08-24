create table data_quality_rule (
  tenant_id uuid not null,
  data_quality_rule_id uuid not null,
  rule_code varchar(128) not null,
  rule_name varchar(256) not null check (length(trim(rule_name)) >= 2),
  dimension varchar(24) not null
    check (dimension in ('COMPLETENESS', 'CONSISTENCY', 'TIMELINESS', 'UNIQUENESS', 'VALIDITY')),
  target_entity varchar(128) not null check (length(trim(target_entity)) >= 2),
  threshold numeric(5,4) not null check (threshold between 0 and 1),
  severity varchar(16) not null check (severity in ('INFO', 'WARNING', 'BLOCKING')),
  status varchar(16) not null check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, data_quality_rule_id),
  unique (tenant_id, rule_code)
);

create index data_quality_rule_dimension_idx
  on data_quality_rule (tenant_id, dimension, status, rule_code);

create function prevent_data_quality_rule_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'data quality rule identity is immutable once registered';
end $$;

create trigger data_quality_rule_immutable
  before update of rule_code, dimension, target_entity, threshold, severity on data_quality_rule
  for each row execute function prevent_data_quality_rule_mutation();
