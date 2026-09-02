create table document_signature_verification_run (
  tenant_id uuid not null,
  verification_run_id uuid not null,
  document_id uuid not null,
  document_version_id uuid not null,
  outcome varchar(24) not null check (outcome in ('VALID', 'INVALID', 'UNAVAILABLE')),
  verified_count integer not null check (verified_count >= 0),
  invalid_count integer not null check (invalid_count >= 0),
  provider_code varchar(64) not null,
  details jsonb not null,
  verified_by uuid not null,
  verified_at timestamptz not null default now(),
  primary key (tenant_id, verification_run_id),
  foreign key (tenant_id, document_id, document_version_id)
    references clinical_document_version(tenant_id, document_id, document_version_id),
  foreign key (tenant_id, verified_by) references app_user(tenant_id, user_id)
);

create index document_signature_verification_version_idx
  on document_signature_verification_run(tenant_id, document_id, document_version_id, verified_at desc);

create function prevent_document_signature_verification_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'document signature verification runs are immutable';
end;
$$;

create trigger document_signature_verification_immutable
  before update or delete on document_signature_verification_run
  for each row execute function prevent_document_signature_verification_mutation();
