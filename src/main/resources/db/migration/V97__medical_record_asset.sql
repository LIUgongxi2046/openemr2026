create table medical_record_asset (
  tenant_id uuid not null,
  medical_record_asset_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid,
  asset_type varchar(16) not null check (asset_type in ('PAPER', 'SCAN', 'DIGITAL')),
  location varchar(128) not null check (length(trim(location)) >= 2),
  content_hash varchar(64) not null,
  status varchar(16) not null check (status in ('ARCHIVED', 'BORROWED')),
  borrowed_by uuid,
  borrowed_at timestamptz,
  due_at timestamptz,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, medical_record_asset_id),
  constraint medical_record_asset_content_hash_check check (length(content_hash) = 64),
  constraint medical_record_asset_borrowed_check
    check ((status = 'BORROWED') = (borrowed_by is not null and borrowed_at is not null and due_at is not null)),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, borrowed_by) references app_user(tenant_id, user_id)
);

create index medical_record_asset_patient_idx
  on medical_record_asset (tenant_id, patient_id, status, created_at desc, medical_record_asset_id desc);

create function prevent_medical_record_asset_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'medical record asset identity and content hash are immutable once catalogued';
end $$;

create trigger medical_record_asset_immutable
  before update of patient_id, encounter_id, asset_type, location, content_hash
  on medical_record_asset
  for each row execute function prevent_medical_record_asset_mutation();
