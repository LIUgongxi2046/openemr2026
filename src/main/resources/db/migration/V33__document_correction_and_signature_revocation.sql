create table document_correction_case (
  tenant_id uuid not null,
  correction_id uuid not null,
  document_id uuid not null,
  source_document_version_id uuid not null,
  correction_document_version_id uuid not null,
  correction_type varchar(24) not null check (correction_type in ('CORRECTION', 'ADDENDUM')),
  correction_reason text not null check (length(trim(correction_reason)) between 4 and 2000),
  status varchar(24) not null check (status in ('DRAFT', 'SIGNED', 'VOID')),
  requested_by uuid not null,
  requested_at timestamptz not null default now(),
  signed_at timestamptz,
  primary key (tenant_id, correction_id),
  unique (tenant_id, correction_document_version_id),
  foreign key (tenant_id, document_id, source_document_version_id)
    references clinical_document_version(tenant_id, document_id, document_version_id),
  foreign key (tenant_id, document_id, correction_document_version_id)
    references clinical_document_version(tenant_id, document_id, document_version_id),
  foreign key (tenant_id, requested_by) references app_user(tenant_id, user_id),
  check ((status = 'SIGNED') = (signed_at is not null))
);

create index document_correction_case_document_idx
  on document_correction_case(tenant_id, document_id, requested_at desc);

create table document_signature_revocation (
  tenant_id uuid not null,
  revocation_id uuid not null,
  signature_id uuid not null,
  document_id uuid not null,
  document_version_id uuid not null,
  revocation_reason text not null check (length(trim(revocation_reason)) between 4 and 2000),
  revoked_by uuid not null,
  revoked_at timestamptz not null default now(),
  primary key (tenant_id, revocation_id),
  unique (tenant_id, signature_id),
  foreign key (tenant_id, signature_id) references signature_evidence(tenant_id, signature_id),
  foreign key (tenant_id, document_id, document_version_id)
    references clinical_document_version(tenant_id, document_id, document_version_id),
  foreign key (tenant_id, revoked_by) references app_user(tenant_id, user_id)
);

create table document_correction_propagation (
  tenant_id uuid not null,
  propagation_id uuid not null,
  correction_id uuid not null,
  destination_code varchar(96) not null,
  status varchar(24) not null check (status in ('PENDING', 'SUCCEEDED', 'FAILED')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error_code varchar(128),
  last_attempt_at timestamptz,
  delivered_at timestamptz,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  primary key (tenant_id, propagation_id),
  unique (tenant_id, correction_id, destination_code),
  foreign key (tenant_id, correction_id) references document_correction_case(tenant_id, correction_id),
  check ((status = 'SUCCEEDED') = (delivered_at is not null)),
  check (status <> 'FAILED' or last_error_code is not null)
);

create table document_correction_event (
  tenant_id uuid not null,
  correction_event_id uuid not null,
  correction_id uuid not null,
  event_type varchar(48) not null check (event_type in (
    'CORRECTION_CREATED', 'CORRECTION_SIGNED', 'PROPAGATION_FAILED', 'PROPAGATION_SUCCEEDED')),
  actor_user_id uuid not null,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  primary key (tenant_id, correction_event_id),
  foreign key (tenant_id, correction_id) references document_correction_case(tenant_id, correction_id),
  foreign key (tenant_id, actor_user_id) references app_user(tenant_id, user_id)
);

create or replace function protect_document_legal_event()
returns trigger language plpgsql as $protect$
begin
  raise exception 'document legal evidence is immutable' using errcode = '23514';
end
$protect$;

create trigger document_signature_revocation_immutable
before update or delete on document_signature_revocation
for each row execute function protect_document_legal_event();

create trigger document_correction_event_immutable
before update or delete on document_correction_event
for each row execute function protect_document_legal_event();
