create table imaging_order (
  tenant_id uuid not null,
  imaging_order_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  modality varchar(16) not null check (modality in ('CT', 'MRI', 'XRAY', 'ULTRASOUND')),
  body_part varchar(32) not null check (body_part in ('HEAD', 'NECK', 'CHEST', 'ABDOMEN', 'PELVIS', 'SPINE', 'UPPER_EXTREMITY', 'LOWER_EXTREMITY', 'OTHER')),
  laterality varchar(16) not null check (laterality in ('NONE', 'LEFT', 'RIGHT', 'BILATERAL')),
  contrast_required boolean not null default false,
  status varchar(16) not null check (status in ('ORDERED', 'PERFORMED', 'REPORTED', 'CANCELLED')),
  ordered_at timestamptz not null,
  performed_at timestamptz,
  reported_at timestamptz,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, imaging_order_id),
  check (body_part not in ('UPPER_EXTREMITY', 'LOWER_EXTREMITY') or laterality <> 'NONE'),
  check (performed_at is null or performed_at >= ordered_at),
  check (reported_at is null or reported_at >= performed_at),
  check ((status in ('PERFORMED', 'REPORTED')) = (performed_at is not null)),
  check ((status = 'REPORTED') = (reported_at is not null)),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id)
);

create index imaging_order_patient_idx
  on imaging_order (tenant_id, patient_id, status, ordered_at desc, imaging_order_id desc);

create function prevent_imaging_order_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'imaging order identity is immutable once created';
end $$;

create trigger imaging_order_immutable
  before update of patient_id, encounter_id, facility_id, modality, body_part, laterality,
    contrast_required, ordered_at on imaging_order
  for each row execute function prevent_imaging_order_mutation();
