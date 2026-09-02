alter table medical_record_asset
  add column record_category varchar(24),
  add column retention_basis_date date,
  add column retention_until date,
  add column malware_scan_engine varchar(128),
  add column cda_validation_engine varchar(128),
  add column cda_validation_evidence_hash char(64),
  add column cda_validated_at timestamptz,
  add column storage_provider varchar(64) not null default 'CATALOG_ONLY',
  add column object_lock_evidence varchar(512),
  add column legal_hold_status varchar(24) not null default 'NONE';

update medical_record_asset asset
set record_category = case when encounter.encounter_type = 'INPATIENT' then 'INPATIENT' else 'OUTPATIENT' end,
    retention_basis_date = coalesce(encounter.ended_at::date, encounter.started_at::date, asset.created_at::date),
    retention_years = greatest(asset.retention_years,
      case when encounter.encounter_type = 'INPATIENT' then 30 else 15 end)
from encounter
where encounter.tenant_id = asset.tenant_id and encounter.encounter_id = asset.encounter_id;

update medical_record_asset
set record_category = 'INPATIENT',
    retention_basis_date = created_at::date,
    retention_years = greatest(retention_years, 30)
where record_category is null;

update medical_record_asset
set retention_until = (retention_basis_date + make_interval(years => retention_years))::date;

update medical_record_asset set cda_status = 'PENDING'
where cda_status in ('VERIFIED', 'FAILED');

-- Historical rows may carry a successful scan state without retaining the
-- scanner identity.  Such rows must be re-scanned; inventing a scanner would
-- turn a data migration into false security evidence.
alter table medical_record_asset disable trigger medical_record_asset_binary_worm_protected;
update medical_record_asset
set malware_scan_status = 'NOT_SCANNED'
where malware_scan_status in ('PASSED', 'REJECTED') and malware_scan_engine is null;
alter table medical_record_asset enable trigger medical_record_asset_binary_worm_protected;

-- A legacy WORM lock cannot be silently unlocked because V199 couples it to
-- sealed storage and retention.  Keep the lock, but make the evidence gap
-- explicit so operations can remediate it instead of mistaking it for proof.
update medical_record_asset
set object_lock_evidence = 'LEGACY_LOCK_EVIDENCE_NOT_RECORDED'
where object_lock_status = 'LOCKED' and object_lock_evidence is null;

alter table medical_record_asset alter column record_category set not null;
alter table medical_record_asset alter column retention_basis_date set not null;
alter table medical_record_asset alter column retention_until set not null;
alter table medical_record_asset add constraint medical_record_asset_record_category_check
  check (record_category in ('OUTPATIENT', 'INPATIENT'));
alter table medical_record_asset add constraint medical_record_asset_cn_retention_check
  check ((record_category = 'OUTPATIENT' and retention_years >= 15)
    or (record_category = 'INPATIENT' and retention_years >= 30));
alter table medical_record_asset add constraint medical_record_asset_retention_until_check
  check (retention_until >= (retention_basis_date + make_interval(years => retention_years))::date);
alter table medical_record_asset add constraint medical_record_asset_legal_hold_check
  check (legal_hold_status in ('NONE', 'ACTIVE', 'RELEASED'));
alter table medical_record_asset add constraint medical_record_asset_malware_evidence_check
  check ((malware_scan_status = 'NOT_SCANNED' and malware_scan_engine is null)
    or (malware_scan_status in ('PASSED', 'REJECTED') and malware_scan_engine is not null));
alter table medical_record_asset add constraint medical_record_asset_cda_validation_evidence_check
  check ((cda_status in ('NOT_APPLICABLE', 'PENDING') and cda_validation_engine is null
      and cda_validation_evidence_hash is null and cda_validated_at is null)
    or (cda_status in ('VERIFIED', 'FAILED') and cda_validation_engine is not null
      and cda_validation_evidence_hash ~ '^[0-9a-f]{64}$' and cda_validated_at is not null));
alter table medical_record_asset add constraint medical_record_asset_object_lock_evidence_check
  check ((object_lock_status = 'UNLOCKED' and object_lock_evidence is null)
    or (object_lock_status = 'LOCKED' and object_lock_evidence is not null));

create function enforce_medical_record_asset_cn_retention() returns trigger language plpgsql as $$
declare
  encounter_kind varchar(32);
  encounter_anchor date;
  minimum_years integer;
begin
  if new.encounter_id is not null then
    select encounter_type, coalesce(ended_at::date, started_at::date)
      into encounter_kind, encounter_anchor
    from encounter
    where tenant_id = new.tenant_id and encounter_id = new.encounter_id
      and patient_id = new.patient_id;
    if encounter_kind is null then
      raise exception 'medical record asset encounter context is invalid' using errcode = '23514';
    end if;
  end if;
  new.record_category := case when encounter_kind = 'INPATIENT' then 'INPATIENT' else
    case when new.encounter_id is null then 'INPATIENT' else 'OUTPATIENT' end end;
  new.retention_basis_date := coalesce(encounter_anchor, new.retention_basis_date, current_date);
  minimum_years := case when new.record_category = 'INPATIENT' then 30 else 15 end;
  if new.retention_years < minimum_years then
    raise exception 'medical record asset retention is below the Chinese medical record minimum'
      using errcode = '23514';
  end if;
  new.retention_until := (new.retention_basis_date + make_interval(years => new.retention_years))::date;
  if tg_op = 'UPDATE' and old.object_lock_status = 'LOCKED' then
    if new.retention_until < old.retention_until or new.retention_basis_date <> old.retention_basis_date then
      raise exception 'locked medical record retention cannot be shortened or rebased' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'UPDATE' and old.legal_hold_status = 'ACTIVE' and new.status = 'RETIRED' then
    raise exception 'medical record asset under legal hold cannot be retired' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger medical_record_asset_cn_retention_enforced
  before insert or update of encounter_id, patient_id, retention_years, object_lock_status, status
  on medical_record_asset for each row execute function enforce_medical_record_asset_cn_retention();

alter table medical_record_asset_distribution_package
  add column requester_type varchar(24) not null default 'PATIENT',
  add column identity_verification_method varchar(64) not null default 'LEGACY_NOT_RECORDED',
  add column authorization_basis varchar(500) not null default 'LEGACY_NOT_RECORDED',
  add column copy_scope varchar(500) not null default 'SINGLE_ASSET',
  add column separate_consent_confirmed boolean not null default false,
  add column hospital_seal_no varchar(128),
  add column delivery_channel varchar(32) not null default 'ON_SITE',
  add column delivery_receipt_no varchar(128);

alter table medical_record_asset_distribution_package add constraint medical_record_asset_distribution_requester_check
  check (requester_type in ('PATIENT', 'AUTHORIZED_AGENT', 'INSURER', 'PUBLIC_SECURITY', 'JUDICIAL', 'OTHER_AUTHORIZED'));
alter table medical_record_asset_distribution_package add constraint medical_record_asset_distribution_delivery_channel_check
  check (delivery_channel in ('ON_SITE', 'SECURE_PORTAL', 'ENCRYPTED_MEDIA'));
alter table medical_record_asset_distribution_package add constraint medical_record_asset_distribution_consent_check
  check (separate_consent_confirmed or requester_type in ('PUBLIC_SECURITY', 'JUDICIAL')
    or identity_verification_method = 'LEGACY_NOT_RECORDED');
alter table medical_record_asset_distribution_package add constraint medical_record_asset_distribution_delivery_evidence_check
  check ((status = 'READY' and delivery_receipt_no is null)
    or (status = 'DELIVERED' and ((hospital_seal_no is not null and delivery_receipt_no is not null)
      or identity_verification_method = 'LEGACY_NOT_RECORDED')));

create or replace function protect_medical_record_asset_distribution_package() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'medical record asset distribution packages are immutable evidence' using errcode = '23514';
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
    or new.created_at <> old.created_at
    or new.requester_type <> old.requester_type
    or new.identity_verification_method <> old.identity_verification_method
    or new.authorization_basis <> old.authorization_basis
    or new.copy_scope <> old.copy_scope
    or new.separate_consent_confirmed <> old.separate_consent_confirmed
    or new.delivery_channel <> old.delivery_channel then
    raise exception 'medical record asset distribution package identity and content are immutable' using errcode = '23514';
  end if;
  return new;
end $$;
