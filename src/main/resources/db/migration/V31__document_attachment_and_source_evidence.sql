create table clinical_document_attachment (
  tenant_id uuid not null,
  attachment_id uuid not null,
  document_id uuid not null,
  document_version_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  original_filename varchar(512) not null check (length(trim(original_filename)) > 0),
  media_type varchar(128) not null check (length(trim(media_type)) > 0),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 26214400),
  content_hash char(64) not null check (content_hash ~ '^[0-9a-f]{64}$'),
  storage_key varchar(512) not null check (length(trim(storage_key)) > 0),
  storage_status varchar(24) not null check (storage_status in ('AVAILABLE', 'QUARANTINED', 'REJECTED', 'MISSING')),
  malware_scan_status varchar(24) not null check (malware_scan_status in ('PASSED', 'PENDING', 'FAILED', 'UNAVAILABLE')),
  uploaded_by uuid not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, attachment_id),
  unique (tenant_id, storage_key),
  unique (tenant_id, document_version_id, content_hash, original_filename),
  foreign key (tenant_id, document_id, document_version_id)
    references clinical_document_version(tenant_id, document_id, document_version_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, uploaded_by) references app_user(tenant_id, user_id),
  check ((storage_status = 'AVAILABLE') = (malware_scan_status = 'PASSED'))
);

create index clinical_document_attachment_document_idx
  on clinical_document_attachment(tenant_id, document_id, document_version_id, created_at);

create table clinical_document_source_reference (
  tenant_id uuid not null,
  source_reference_id uuid not null,
  document_id uuid not null,
  document_version_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  source_type varchar(24) not null check (source_type in ('DIAGNOSIS', 'ORDER', 'RESULT', 'ATTACHMENT')),
  source_resource_id uuid not null,
  source_version_ref varchar(128) not null check (length(trim(source_version_ref)) > 0),
  target_field_path varchar(512) not null check (target_field_path ~ '^sections\.[A-Za-z0-9_.-]+$'),
  display_label varchar(512) not null check (length(trim(display_label)) > 0),
  excerpt_hash char(64) check (excerpt_hash is null or excerpt_hash ~ '^[0-9a-f]{64}$'),
  recorded_by uuid not null,
  recorded_at timestamptz not null default now(),
  primary key (tenant_id, source_reference_id),
  unique (tenant_id, document_version_id, source_type, source_resource_id, source_version_ref, target_field_path),
  foreign key (tenant_id, document_id, document_version_id)
    references clinical_document_version(tenant_id, document_id, document_version_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, recorded_by) references app_user(tenant_id, user_id)
);

create index clinical_document_source_document_idx
  on clinical_document_source_reference(tenant_id, document_id, document_version_id, recorded_at);

create function prevent_document_attachment_source_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'document attachments and source references are immutable';
end $$;

create trigger clinical_document_attachment_immutable
  before update or delete on clinical_document_attachment
  for each row execute function prevent_document_attachment_source_mutation();

create trigger clinical_document_source_reference_immutable
  before update or delete on clinical_document_source_reference
  for each row execute function prevent_document_attachment_source_mutation();

-- A quality result is only reusable while both authored content and every
-- referenced clinical fact remain at the versions inspected by that run.
alter table document_quality_run add column source_watermark char(64);
alter table document_quality_run disable trigger document_quality_run_immutable;
update document_quality_run set source_watermark = repeat('0', 64);
alter table document_quality_run enable trigger document_quality_run_immutable;
alter table document_quality_run alter column source_watermark set not null;
alter table document_quality_run add constraint document_quality_run_source_watermark_sha256
  check (source_watermark ~ '^[0-9a-f]{64}$');
