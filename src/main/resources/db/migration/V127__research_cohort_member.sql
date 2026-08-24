create table research_cohort_member (
  tenant_id uuid not null,
  cohort_member_id uuid not null,
  research_cohort_id uuid not null,
  patient_id uuid not null,
  computed_by uuid not null,
  computed_at timestamptz not null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  primary key (tenant_id, cohort_member_id),
  constraint research_cohort_member_unique unique (tenant_id, research_cohort_id, patient_id),
  foreign key (tenant_id, research_cohort_id) references research_cohort(tenant_id, research_cohort_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, computed_by) references app_user(tenant_id, user_id)
);

create index research_cohort_member_cohort_idx
  on research_cohort_member (tenant_id, research_cohort_id, computed_at desc, cohort_member_id desc);

create function prevent_research_cohort_member_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'research cohort member is immutable once computed';
end $$;

create trigger research_cohort_member_immutable
  before update or delete on research_cohort_member
  for each row execute function prevent_research_cohort_member_mutation();
