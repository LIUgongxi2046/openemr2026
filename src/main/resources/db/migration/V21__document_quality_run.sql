create table document_quality_run (
  tenant_id uuid not null,
  quality_run_id uuid not null,
  document_id uuid not null,
  document_version_id uuid not null,
  rule_version varchar(64) not null check (length(trim(rule_version)) > 0),
  outcome varchar(24) not null check (outcome in ('PASSED', 'WARNING', 'BLOCKED')),
  finding_count integer not null check (finding_count >= 0),
  blocking_count integer not null check (blocking_count >= 0),
  warning_count integer not null check (warning_count >= 0),
  content_hash char(64) not null check (content_hash ~ '^[0-9a-f]{64}$'),
  executed_by uuid not null,
  executed_at timestamptz not null default now(),
  primary key (tenant_id, quality_run_id),
  foreign key (tenant_id, document_id, document_version_id)
    references clinical_document_version(tenant_id, document_id, document_version_id),
  foreign key (tenant_id, executed_by) references app_user(tenant_id, user_id),
  check (finding_count = blocking_count + warning_count),
  check (
    (outcome = 'PASSED' and finding_count = 0)
    or (outcome = 'WARNING' and blocking_count = 0 and warning_count > 0)
    or (outcome = 'BLOCKED' and blocking_count > 0)
  )
);

create index document_quality_run_latest_idx
  on document_quality_run (tenant_id, document_version_id, executed_at desc, quality_run_id desc);

create function prevent_document_quality_run_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'document quality runs are immutable';
end $$;

create trigger document_quality_run_immutable
  before update or delete on document_quality_run
  for each row execute function prevent_document_quality_run_mutation();
