create table record_review_case (
  tenant_id uuid not null,
  review_case_id uuid not null,
  organization_id uuid not null,
  facility_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  document_id uuid not null,
  document_version_id uuid not null,
  review_scope varchar(24) not null check (review_scope in ('RANDOM', 'FOCUSED', 'TERMINAL', 'CORRECTION')),
  reason varchar(1000) not null check (length(trim(reason)) >= 4),
  priority varchar(16) not null check (priority in ('ROUTINE', 'HIGH', 'URGENT')),
  status varchar(24) not null check (status in ('OPEN', 'ASSIGNED', 'IN_REVIEW', 'REMEDIATION', 'VERIFIED', 'CLOSED', 'VOID')),
  assignee_user_id uuid,
  due_at timestamptz not null,
  created_by uuid not null,
  voided_by uuid,
  voided_at timestamptz,
  void_reason varchar(1000),
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, review_case_id),
  foreign key (tenant_id, organization_id) references organization(tenant_id, organization_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, document_id, document_version_id)
    references clinical_document_version(tenant_id, document_id, document_version_id),
  foreign key (tenant_id, assignee_user_id) references app_user(tenant_id, user_id),
  foreign key (tenant_id, created_by) references app_user(tenant_id, user_id),
  foreign key (tenant_id, voided_by) references app_user(tenant_id, user_id),
  check ((status = 'VOID') = (voided_at is not null and voided_by is not null and void_reason is not null))
);

create index record_review_case_queue_idx
  on record_review_case(tenant_id, organization_id, facility_id, status, priority, due_at, created_at desc);
create index record_review_case_document_idx
  on record_review_case(tenant_id, document_id, created_at desc);

create table record_review_case_event (
  tenant_id uuid not null,
  review_case_event_id uuid not null,
  review_case_id uuid not null,
  sequence_no bigint not null check (sequence_no > 0),
  event_type varchar(48) not null check (event_type in ('CREATED', 'ASSIGNED', 'REVIEW_STARTED', 'REMEDIATION_REQUIRED', 'VERIFIED', 'CLOSED', 'VOIDED')),
  from_status varchar(24),
  to_status varchar(24) not null,
  actor_user_id uuid not null,
  reason varchar(1000),
  occurred_at timestamptz not null default now(),
  primary key (tenant_id, review_case_event_id),
  unique (tenant_id, review_case_id, sequence_no),
  foreign key (tenant_id, review_case_id) references record_review_case(tenant_id, review_case_id),
  foreign key (tenant_id, actor_user_id) references app_user(tenant_id, user_id)
);

create function prevent_record_review_case_event_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'record review case events are immutable';
end;
$$;

create trigger record_review_case_event_immutable
  before update or delete on record_review_case_event
  for each row execute function prevent_record_review_case_event_mutation();
