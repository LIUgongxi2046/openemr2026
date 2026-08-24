create table research_cohort (
  tenant_id uuid not null,
  research_cohort_id uuid not null,
  cohort_code varchar(128) not null,
  cohort_name varchar(256) not null check (length(trim(cohort_name)) >= 2),
  inclusion_criteria text not null check (length(trim(inclusion_criteria)) >= 2),
  exclusion_criteria text,
  status varchar(16) not null check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, research_cohort_id),
  unique (tenant_id, cohort_code)
);

create index research_cohort_status_idx
  on research_cohort (tenant_id, status, cohort_code);

create function prevent_research_cohort_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'research cohort criteria and identity are immutable once defined';
end $$;

create trigger research_cohort_immutable
  before update of cohort_code, inclusion_criteria, exclusion_criteria on research_cohort
  for each row execute function prevent_research_cohort_mutation();
