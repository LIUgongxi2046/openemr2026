create table medication_interaction (
  tenant_id uuid not null,
  interaction_id uuid not null,
  catalog_code varchar(128) not null,
  ingredient_a_code varchar(128) not null,
  ingredient_b_code varchar(128) not null,
  severity varchar(16) not null check (severity in ('CONTRAINDICATED', 'MODERATE')),
  title varchar(256) not null check (length(trim(title)) > 0),
  detail varchar(1000) not null check (length(trim(detail)) > 0),
  evidence_source varchar(256) not null,
  effective_from date not null,
  effective_to date,
  release_version varchar(64) not null,
  status varchar(16) not null check (status in ('DRAFT', 'ACTIVE', 'RETIRED')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, interaction_id),
  unique (tenant_id, catalog_code, ingredient_a_code, ingredient_b_code, release_version),
  check (ingredient_a_code <> ingredient_b_code),
  check (effective_to is null or effective_to >= effective_from)
);

create index medication_interaction_ingredient_idx
  on medication_interaction (tenant_id, ingredient_a_code, ingredient_b_code, status, effective_from);

create function prevent_medication_interaction_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'medication interaction evidence is immutable';
end $$;

create trigger medication_interaction_immutable
  before update or delete on medication_interaction
  for each row execute function prevent_medication_interaction_mutation();
