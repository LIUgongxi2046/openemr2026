create table archive_case (
  tenant_id uuid not null,
  archive_case_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  archive_no varchar(96) not null check (length(trim(archive_no)) > 0),
  status varchar(24) not null check (status in ('ARCHIVED', 'SEALED', 'UNSEALED')),
  manifest_hash char(64) not null check (manifest_hash ~ '^[0-9a-f]{64}$'),
  archived_by uuid not null,
  archived_at timestamptz not null,
  sealed_by uuid,
  sealed_at timestamptz,
  unsealed_by uuid,
  unsealed_at timestamptz,
  unseal_reason varchar(1000),
  row_version bigint not null default 1 check (row_version > 0),
  primary key (tenant_id, archive_case_id),
  unique (tenant_id, archive_no),
  unique (tenant_id, encounter_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, archived_by) references app_user(tenant_id, user_id),
  foreign key (tenant_id, sealed_by) references app_user(tenant_id, user_id),
  foreign key (tenant_id, unsealed_by) references app_user(tenant_id, user_id),
  check (
    (status = 'ARCHIVED' and sealed_by is null and sealed_at is null
      and unsealed_by is null and unsealed_at is null and unseal_reason is null)
    or (status = 'SEALED' and sealed_by is not null and sealed_at is not null
      and unsealed_by is null and unsealed_at is null and unseal_reason is null)
    or (status = 'UNSEALED' and sealed_by is not null and sealed_at is not null
      and unsealed_by is not null and unsealed_at is not null
      and length(trim(unseal_reason)) >= 4)
  ),
  check (sealed_by is null or sealed_by <> archived_by)
);

create table archive_case_item (
  tenant_id uuid not null,
  archive_case_item_id uuid not null,
  archive_case_id uuid not null,
  document_id uuid not null,
  document_version_id uuid not null,
  document_type_code varchar(96) not null,
  content_hash char(64) not null check (content_hash ~ '^[0-9a-f]{64}$'),
  signature_summary_hash char(64) not null check (signature_summary_hash ~ '^[0-9a-f]{64}$'),
  item_order integer not null check (item_order > 0),
  primary key (tenant_id, archive_case_item_id),
  unique (tenant_id, archive_case_id, document_id, document_version_id),
  unique (tenant_id, archive_case_id, item_order),
  foreign key (tenant_id, archive_case_id) references archive_case(tenant_id, archive_case_id),
  foreign key (tenant_id, document_id, document_version_id)
    references clinical_document_version(tenant_id, document_id, document_version_id)
);

create table archive_case_event (
  tenant_id uuid not null,
  archive_case_event_id uuid not null,
  archive_case_id uuid not null,
  event_no bigint not null check (event_no > 0),
  event_type varchar(32) not null check (event_type in ('ARCHIVED', 'SEALED', 'UNSEALED', 'EXPORT_CREATED')),
  actor_user_id uuid not null,
  reason varchar(1000),
  occurred_at timestamptz not null default now(),
  primary key (tenant_id, archive_case_event_id),
  unique (tenant_id, archive_case_id, event_no),
  foreign key (tenant_id, archive_case_id) references archive_case(tenant_id, archive_case_id),
  foreign key (tenant_id, actor_user_id) references app_user(tenant_id, user_id),
  check (event_type <> 'UNSEALED' or length(trim(reason)) >= 4)
);

create table archive_export_package (
  tenant_id uuid not null,
  export_package_id uuid not null,
  archive_case_id uuid not null,
  purpose varchar(256) not null check (length(trim(purpose)) >= 2),
  output_format varchar(24) not null check (output_format = 'JSON'),
  status varchar(24) not null check (status = 'READY'),
  content_text text not null check (content_text is json),
  content_hash char(64) not null check (content_hash ~ '^[0-9a-f]{64}$'),
  byte_count bigint not null check (byte_count > 0),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, export_package_id),
  foreign key (tenant_id, archive_case_id) references archive_case(tenant_id, archive_case_id),
  foreign key (tenant_id, created_by) references app_user(tenant_id, user_id)
);

create index archive_case_patient_idx
  on archive_case (tenant_id, patient_id, archived_at desc, archive_case_id);
create index archive_case_event_timeline_idx
  on archive_case_event (tenant_id, archive_case_id, event_no);
create index archive_export_package_case_idx
  on archive_export_package (tenant_id, archive_case_id, created_at desc, export_package_id);

create function protect_archive_case() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'archive cases cannot be deleted' using errcode = '23514';
  end if;
  if new.tenant_id <> old.tenant_id
      or new.archive_case_id <> old.archive_case_id
      or new.patient_id <> old.patient_id
      or new.encounter_id <> old.encounter_id
      or new.archive_no <> old.archive_no
      or new.manifest_hash <> old.manifest_hash
      or new.archived_by <> old.archived_by
      or new.archived_at <> old.archived_at then
    raise exception 'archive identity and manifest are immutable' using errcode = '23514';
  end if;
  if new.row_version <> old.row_version + 1 then
    raise exception 'archive transition must advance row version' using errcode = '23514';
  end if;
  if not ((old.status = 'ARCHIVED' and new.status = 'SEALED')
      or (old.status = 'SEALED' and new.status = 'UNSEALED')
      or (old.status = 'UNSEALED' and new.status = 'SEALED')) then
    raise exception 'invalid archive state transition' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger archive_case_protected
  before update or delete on archive_case
  for each row execute function protect_archive_case();

create function prevent_archive_evidence_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'archive evidence is immutable' using errcode = '23514';
end $$;

create trigger archive_case_item_immutable
  before update or delete on archive_case_item
  for each row execute function prevent_archive_evidence_mutation();
create trigger archive_case_event_immutable
  before update or delete on archive_case_event
  for each row execute function prevent_archive_evidence_mutation();
create trigger archive_export_package_immutable
  before update or delete on archive_export_package
  for each row execute function prevent_archive_evidence_mutation();
