create table source_patient_match_candidate (
  tenant_id uuid not null,
  candidate_id uuid not null,
  source_system_id uuid not null,
  source_patient_identifier varchar(256) not null check (length(trim(source_patient_identifier)) >= 2),
  display_name varchar(256) not null check (length(trim(display_name)) >= 2),
  sex_code varchar(32) not null,
  birth_date date not null,
  matched_patient_id uuid,
  match_score numeric(4,3) not null,
  review_status varchar(24) not null check (review_status in ('PENDING', 'RESOLVED')),
  resolved_by uuid,
  resolved_at timestamptz,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  primary key (tenant_id, candidate_id),
  constraint source_patient_match_candidate_unique unique (tenant_id, source_system_id, source_patient_identifier),
  constraint source_patient_match_candidate_score_check check (match_score between 0 and 1),
  constraint source_patient_match_candidate_resolve_check
    check ((review_status = 'RESOLVED') = (resolved_by is not null and resolved_at is not null)),
  foreign key (tenant_id, source_system_id) references source_system_inventory(tenant_id, source_system_id),
  foreign key (tenant_id, matched_patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, resolved_by) references app_user(tenant_id, user_id)
);

create index source_patient_match_candidate_source_idx
  on source_patient_match_candidate (tenant_id, source_system_id, review_status, created_at desc, candidate_id desc);

create function prevent_source_patient_match_candidate_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'patient match candidate identity is immutable once recorded';
end $$;

create trigger source_patient_match_candidate_immutable
  before update of source_system_id, source_patient_identifier, display_name, sex_code, birth_date, match_score
  on source_patient_match_candidate
  for each row execute function prevent_source_patient_match_candidate_mutation();
