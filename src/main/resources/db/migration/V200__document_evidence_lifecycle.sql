create table clinical_document_evidence_lifecycle_event (
  tenant_id uuid not null,
  lifecycle_event_id uuid not null,
  document_id uuid not null,
  document_version_id uuid not null,
  evidence_type varchar(32) not null
    check (evidence_type in ('ATTACHMENT', 'SOURCE_REFERENCE')),
  evidence_id uuid not null,
  event_type varchar(24) not null
    check (event_type in ('CORRECTED', 'REVOKED', 'SUPERSEDED', 'VOIDED')),
  replacement_evidence_id uuid,
  effective_target_field_path varchar(512),
  effective_excerpt_hash char(64),
  reason varchar(2000) not null check (length(trim(reason)) >= 4),
  actor_user_id uuid not null,
  occurred_at timestamptz not null default now(),
  primary key (tenant_id, lifecycle_event_id),
  foreign key (tenant_id, document_id, document_version_id)
    references clinical_document_version(tenant_id, document_id, document_version_id),
  foreign key (tenant_id, actor_user_id) references app_user(tenant_id, user_id),
  check (effective_target_field_path is null
    or effective_target_field_path ~ '^sections\.[A-Za-z0-9_.-]+$'),
  check (effective_excerpt_hash is null or effective_excerpt_hash ~ '^[0-9a-f]{64}$'),
  check ((event_type = 'CORRECTED') = (effective_target_field_path is not null)),
  check ((event_type = 'SUPERSEDED') = (replacement_evidence_id is not null)),
  check (evidence_type = 'SOURCE_REFERENCE' or event_type <> 'CORRECTED'),
  check (evidence_type = 'ATTACHMENT' or event_type <> 'VOIDED')
);

create index clinical_document_evidence_lifecycle_lookup_idx
  on clinical_document_evidence_lifecycle_event(
    tenant_id, evidence_type, evidence_id, occurred_at desc, lifecycle_event_id desc);

create unique index clinical_document_evidence_terminal_uk
  on clinical_document_evidence_lifecycle_event(tenant_id, evidence_type, evidence_id)
  where event_type in ('REVOKED', 'SUPERSEDED', 'VOIDED');

create function prevent_document_evidence_lifecycle_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'document evidence lifecycle events are immutable';
end $$;

create trigger clinical_document_evidence_lifecycle_immutable
  before update or delete on clinical_document_evidence_lifecycle_event
  for each row execute function prevent_document_evidence_lifecycle_mutation();

comment on table clinical_document_evidence_lifecycle_event is
  'Append-only corrections, revocations, replacements and voids for immutable document evidence.';
