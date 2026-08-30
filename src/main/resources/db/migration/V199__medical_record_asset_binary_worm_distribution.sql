alter table medical_record_asset
  add column original_filename varchar(255),
  add column byte_size bigint,
  add column storage_key varchar(768),
  add column storage_status varchar(24) not null default 'MISSING',
  add column malware_scan_status varchar(24) not null default 'NOT_SCANNED',
  add column ocr_status varchar(24) not null default 'NOT_REQUESTED',
  add column ocr_text text,
  add column ocr_confidence numeric(5,4),
  add column ocr_engine varchar(128),
  add column ocr_completed_at timestamptz,
  add column object_lock_status varchar(24) not null default 'UNLOCKED',
  add column worm_retain_until timestamptz;

alter table medical_record_asset add constraint medical_record_asset_binary_check check (
  (storage_status = 'MISSING' and original_filename is null and byte_size is null and storage_key is null)
  or
  (storage_status in ('AVAILABLE', 'SEALED') and original_filename is not null
    and byte_size is not null and byte_size > 0 and storage_key is not null)
);
alter table medical_record_asset add constraint medical_record_asset_storage_status_check
  check (storage_status in ('MISSING', 'AVAILABLE', 'SEALED'));
alter table medical_record_asset add constraint medical_record_asset_malware_status_check
  check (malware_scan_status in ('NOT_SCANNED', 'PASSED', 'REJECTED'));
alter table medical_record_asset add constraint medical_record_asset_ocr_status_check
  check (ocr_status in ('NOT_REQUESTED', 'COMPLETED', 'FAILED'));
alter table medical_record_asset add constraint medical_record_asset_ocr_result_check check (
  (ocr_status <> 'COMPLETED')
  or (ocr_text is not null and length(ocr_text) > 0 and ocr_confidence between 0 and 1
    and ocr_engine is not null and ocr_completed_at is not null)
);
alter table medical_record_asset add constraint medical_record_asset_object_lock_check check (
  (object_lock_status = 'UNLOCKED' and worm_retain_until is null)
  or (object_lock_status = 'LOCKED' and storage_status = 'SEALED' and worm_retain_until is not null)
);

create function protect_medical_record_asset_binary_and_worm() returns trigger language plpgsql as $$
begin
  if old.storage_status <> 'MISSING' and (
    new.original_filename is distinct from old.original_filename
    or new.byte_size is distinct from old.byte_size
    or new.storage_key is distinct from old.storage_key
    or new.malware_scan_status is distinct from old.malware_scan_status) then
    raise exception 'medical record asset original binary identity is immutable';
  end if;
  if old.storage_status = 'SEALED' and new.storage_status <> 'SEALED' then
    raise exception 'sealed medical record asset storage cannot be unlocked';
  end if;
  if old.object_lock_status = 'LOCKED' and (
    new.object_lock_status <> 'LOCKED'
    or new.worm_retain_until is null
    or new.worm_retain_until < old.worm_retain_until
    or new.status = 'RETIRED') then
    raise exception 'medical record asset WORM retention cannot be removed or shortened';
  end if;
  return new;
end $$;

create trigger medical_record_asset_binary_worm_protected
  before update on medical_record_asset
  for each row execute function protect_medical_record_asset_binary_and_worm();

create table medical_record_asset_distribution_package (
  tenant_id uuid not null,
  distribution_package_id uuid not null,
  medical_record_asset_id uuid not null,
  patient_id uuid not null,
  purpose varchar(500) not null,
  recipient_name varchar(256) not null,
  watermark_text varchar(500) not null,
  original_filename varchar(255) not null,
  media_type varchar(96) not null default 'application/zip',
  byte_size bigint not null check (byte_size > 0),
  content_hash char(64) not null check (content_hash ~ '^[0-9a-f]{64}$'),
  storage_key varchar(768) not null,
  status varchar(24) not null check (status in ('READY', 'DELIVERED')),
  expires_at timestamptz not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  delivered_by uuid,
  delivered_at timestamptz,
  row_version bigint not null default 1 check (row_version > 0),
  primary key (tenant_id, distribution_package_id),
  foreign key (tenant_id, medical_record_asset_id)
    references medical_record_asset(tenant_id, medical_record_asset_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, created_by) references app_user(tenant_id, user_id),
  foreign key (tenant_id, delivered_by) references app_user(tenant_id, user_id),
  unique (tenant_id, storage_key),
  check ((status = 'READY' and delivered_by is null and delivered_at is null)
    or (status = 'DELIVERED' and delivered_by is not null and delivered_at is not null))
);

create index medical_record_asset_distribution_idx
  on medical_record_asset_distribution_package(tenant_id, medical_record_asset_id, created_at desc);

create function protect_medical_record_asset_distribution_package() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'medical record asset distribution packages are immutable evidence';
  end if;
  if new.tenant_id <> old.tenant_id
    or new.distribution_package_id <> old.distribution_package_id
    or new.medical_record_asset_id <> old.medical_record_asset_id
    or new.patient_id <> old.patient_id
    or new.purpose <> old.purpose
    or new.recipient_name <> old.recipient_name
    or new.watermark_text <> old.watermark_text
    or new.original_filename <> old.original_filename
    or new.media_type <> old.media_type
    or new.byte_size <> old.byte_size
    or new.content_hash <> old.content_hash
    or new.storage_key <> old.storage_key
    or new.expires_at <> old.expires_at
    or new.created_by <> old.created_by
    or new.created_at <> old.created_at then
    raise exception 'medical record asset distribution package identity and content are immutable';
  end if;
  return new;
end $$;

create trigger medical_record_asset_distribution_package_protected
  before update or delete on medical_record_asset_distribution_package
  for each row execute function protect_medical_record_asset_distribution_package();
