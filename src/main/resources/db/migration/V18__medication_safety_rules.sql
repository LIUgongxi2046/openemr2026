create table medication_catalog_version (
  tenant_id uuid not null,
  medication_catalog_version_id uuid not null,
  catalog_code varchar(128) not null,
  drug_code varchar(128) not null,
  ingredient_code varchar(128) not null,
  display_name varchar(256) not null check (length(trim(display_name)) > 0),
  minimum_single_dose numeric(18,6) not null check (minimum_single_dose > 0),
  maximum_single_dose numeric(18,6) not null check (maximum_single_dose >= minimum_single_dose),
  dose_unit varchar(64) not null check (length(trim(dose_unit)) > 0),
  effective_from date not null,
  effective_to date,
  release_version varchar(64) not null,
  status varchar(16) not null check (status in ('DRAFT', 'ACTIVE', 'RETIRED')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, medication_catalog_version_id),
  unique (tenant_id, catalog_code, release_version),
  check (effective_to is null or effective_to >= effective_from)
);

create unique index medication_catalog_one_active_idx
  on medication_catalog_version (tenant_id, catalog_code)
  where status = 'ACTIVE';

create table patient_allergy (
  tenant_id uuid not null,
  allergy_id uuid not null,
  patient_id uuid not null,
  substance_code varchar(128) not null,
  display_name varchar(256) not null check (length(trim(display_name)) > 0),
  verification_status varchar(24) not null check (verification_status in ('UNCONFIRMED', 'CONFIRMED', 'REFUTED')),
  clinical_status varchar(16) not null check (clinical_status in ('ACTIVE', 'RESOLVED')),
  severity varchar(16) not null check (severity in ('MILD', 'MODERATE', 'SEVERE', 'UNKNOWN')),
  recorded_by uuid not null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, allergy_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, recorded_by) references app_user(tenant_id, user_id)
);

create unique index patient_active_allergy_substance_idx
  on patient_allergy (tenant_id, patient_id, substance_code)
  where clinical_status = 'ACTIVE' and verification_status <> 'REFUTED';

alter table clinical_order_item
  add column medication_catalog_version_id uuid,
  add column drug_code varchar(128),
  add column ingredient_code varchar(128),
  add column dose_value numeric(18,6),
  add column dose_unit varchar(64),
  add column route_code varchar(64),
  add column frequency_code varchar(64),
  add foreign key (tenant_id, medication_catalog_version_id)
    references medication_catalog_version(tenant_id, medication_catalog_version_id),
  add check (dose_value is null or dose_value > 0);

create table medication_safety_evaluation (
  tenant_id uuid not null,
  evaluation_id uuid not null,
  order_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  evaluated_order_row_version bigint not null check (evaluated_order_row_version > 0),
  rule_watermark varchar(128) not null,
  passed boolean not null,
  blocking_count integer not null check (blocking_count >= 0),
  evaluated_by uuid not null,
  evaluated_at timestamptz not null default now(),
  primary key (tenant_id, evaluation_id),
  foreign key (tenant_id, order_id) references clinical_order(tenant_id, order_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, evaluated_by) references app_user(tenant_id, user_id),
  check (passed = (blocking_count = 0))
);

create table medication_safety_finding (
  tenant_id uuid not null,
  finding_id uuid not null,
  evaluation_id uuid not null,
  order_item_id uuid not null,
  code varchar(64) not null,
  severity varchar(16) not null check (severity in ('BLOCKING', 'WARNING', 'INFO')),
  title varchar(256) not null,
  detail varchar(1000) not null,
  evidence_source varchar(256) not null,
  override_allowed boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (tenant_id, finding_id),
  foreign key (tenant_id, evaluation_id)
    references medication_safety_evaluation(tenant_id, evaluation_id),
  foreign key (tenant_id, order_item_id)
    references clinical_order_item(tenant_id, order_item_id)
);

create index medication_safety_order_idx
  on medication_safety_evaluation (tenant_id, order_id, evaluated_at desc);
create index patient_allergy_patient_idx
  on patient_allergy (tenant_id, patient_id, clinical_status, substance_code);

create function prevent_medication_safety_evidence_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'medication safety evidence is immutable';
end $$;

create trigger medication_safety_evaluation_immutable
  before update or delete on medication_safety_evaluation
  for each row execute function prevent_medication_safety_evidence_mutation();

create trigger medication_safety_finding_immutable
  before update or delete on medication_safety_finding
  for each row execute function prevent_medication_safety_evidence_mutation();

