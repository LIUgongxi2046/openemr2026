create table research_cohort_snapshot (
  tenant_id uuid not null,
  research_cohort_snapshot_id uuid not null,
  research_cohort_id uuid not null,
  member_count integer not null,
  criteria_hash varchar(64) not null,
  computed_at timestamptz not null,
  computed_by uuid not null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  primary key (tenant_id, research_cohort_snapshot_id),
  constraint research_cohort_snapshot_member_count_check check (member_count >= 0),
  constraint research_cohort_snapshot_criteria_hash_check check (length(criteria_hash) = 64),
  foreign key (tenant_id, research_cohort_id)
    references research_cohort(tenant_id, research_cohort_id),
  foreign key (tenant_id, computed_by) references app_user(tenant_id, user_id)
);

create index research_cohort_snapshot_cohort_idx
  on research_cohort_snapshot (tenant_id, research_cohort_id, computed_at desc, research_cohort_snapshot_id desc);

create function prevent_research_cohort_snapshot_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'research cohort snapshot is immutable once recorded';
end $$;

create trigger research_cohort_snapshot_immutable
  before update or delete on research_cohort_snapshot
  for each row execute function prevent_research_cohort_snapshot_mutation();
