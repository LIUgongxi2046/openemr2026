do $body$
declare
  status_constraint text;
begin
  select con.conname into status_constraint
  from pg_constraint con
  join pg_class relation on relation.oid = con.conrelid
  join pg_namespace namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = current_schema()
    and relation.relname = 'patient'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) like '%status%ACTIVE%MERGED%DECEASED%VOID%'
    and pg_get_constraintdef(con.oid) not like '%merged_into_patient_id%'
  order by con.conname
  limit 1;
  if status_constraint is null then
    raise exception 'The patient status constraint was not found';
  end if;
  execute format('alter table patient drop constraint %I', status_constraint);
end
$body$;

alter table patient
  add constraint patient_identity_status_ck
    check (status in ('PENDING_VERIFICATION', 'ACTIVE', 'POSSIBLE_DUPLICATE', 'MERGED', 'DECEASED', 'VOID'));

create table patient_demographic_version (
  tenant_id uuid not null,
  patient_id uuid not null,
  demographic_version_id uuid not null,
  version_no integer not null check (version_no > 0),
  display_name varchar(256) not null,
  sex_code varchar(32) not null,
  birth_date date not null,
  patient_status varchar(24) not null,
  change_type varchar(32) not null check (change_type in ('INITIAL_IMPORT', 'IDENTITY_CORRECTION', 'VERIFICATION')),
  change_reason varchar(1000) not null check (length(trim(change_reason)) >= 4),
  changed_by uuid,
  supersedes_version_id uuid,
  created_at timestamptz not null default now(),
  primary key (tenant_id, demographic_version_id),
  unique (tenant_id, patient_id, version_no),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, changed_by) references app_user(tenant_id, user_id),
  foreign key (tenant_id, supersedes_version_id)
    references patient_demographic_version(tenant_id, demographic_version_id)
);

insert into patient_demographic_version(
  tenant_id, patient_id, demographic_version_id, version_no, display_name, sex_code,
  birth_date, patient_status, change_type, change_reason)
select tenant_id, patient_id, gen_random_uuid(), 1, display_name, sex_code,
  birth_date, status, 'INITIAL_IMPORT', 'V29 baseline identity snapshot'
from patient;

create function prevent_patient_demographic_version_mutation()
returns trigger
language plpgsql
as $body$
begin
  raise exception 'patient demographic versions are immutable' using errcode = '23514';
end
$body$;

create trigger patient_demographic_version_immutable
before update or delete on patient_demographic_version
for each row execute function prevent_patient_demographic_version_mutation();

create table patient_match_candidate (
  tenant_id uuid not null,
  candidate_id uuid not null,
  patient_a_id uuid not null,
  patient_b_id uuid not null,
  match_score numeric(5,4) not null check (match_score between 0 and 1),
  match_signals jsonb not null,
  status varchar(32) not null check (status in ('OPEN', 'DISMISSED', 'MERGE_REQUESTED', 'MERGED')),
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid,
  resolution_reason varchar(1000),
  row_version bigint not null default 1 check (row_version > 0),
  primary key (tenant_id, candidate_id),
  unique (tenant_id, patient_a_id, patient_b_id),
  foreign key (tenant_id, patient_a_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, patient_b_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, resolved_by) references app_user(tenant_id, user_id),
  check (patient_a_id < patient_b_id),
  check (status in ('OPEN', 'MERGE_REQUESTED') or (resolved_at is not null and resolved_by is not null)),
  check (status not in ('DISMISSED', 'MERGED') or resolution_reason is not null)
);

create index patient_match_candidate_queue_idx
  on patient_match_candidate(tenant_id, status, match_score desc, detected_at);

create table patient_merge_case (
  tenant_id uuid not null,
  merge_case_id uuid not null,
  candidate_id uuid,
  source_patient_id uuid not null,
  target_patient_id uuid not null,
  source_status_before_merge varchar(24) not null
    check (source_status_before_merge in ('PENDING_VERIFICATION', 'ACTIVE', 'POSSIBLE_DUPLICATE')),
  status varchar(32) not null
    check (status in ('PENDING_SECOND_REVIEW', 'MERGED', 'REVERSAL_PENDING', 'REVERSED', 'REJECTED')),
  merge_reason varchar(1000) not null check (length(trim(merge_reason)) >= 8),
  conflict_resolution jsonb not null,
  requested_by uuid not null,
  requested_at timestamptz not null default now(),
  approved_by uuid,
  approved_at timestamptz,
  reversal_reason varchar(1000),
  reversal_requested_by uuid,
  reversal_requested_at timestamptz,
  reversed_by uuid,
  reversed_at timestamptz,
  row_version bigint not null default 1 check (row_version > 0),
  primary key (tenant_id, merge_case_id),
  foreign key (tenant_id, candidate_id) references patient_match_candidate(tenant_id, candidate_id),
  foreign key (tenant_id, source_patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, target_patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, requested_by) references app_user(tenant_id, user_id),
  foreign key (tenant_id, approved_by) references app_user(tenant_id, user_id),
  foreign key (tenant_id, reversal_requested_by) references app_user(tenant_id, user_id),
  foreign key (tenant_id, reversed_by) references app_user(tenant_id, user_id),
  check (source_patient_id <> target_patient_id),
  check (approved_by is null or approved_by <> requested_by),
  check (reversed_by is null or reversed_by <> reversal_requested_by),
  check (status not in ('MERGED', 'REVERSAL_PENDING', 'REVERSED') or (approved_by is not null and approved_at is not null)),
  check (status <> 'REVERSAL_PENDING' or (reversal_reason is not null and reversal_requested_by is not null and reversal_requested_at is not null)),
  check (status <> 'REVERSED' or (reversed_by is not null and reversed_at is not null))
);

create unique index patient_merge_case_active_source_idx
  on patient_merge_case(tenant_id, source_patient_id)
  where status in ('PENDING_SECOND_REVIEW', 'MERGED', 'REVERSAL_PENDING');
create index patient_merge_case_queue_idx
  on patient_merge_case(tenant_id, status, requested_at);
