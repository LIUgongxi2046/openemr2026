create table price_catalog_version (
  tenant_id uuid not null,
  price_version_id uuid not null,
  catalog_code varchar(128) not null,
  item_code varchar(128) not null,
  item_name varchar(256) not null check (length(trim(item_name)) > 0),
  unit_price numeric(18,2) not null check (unit_price >= 0),
  unit varchar(32) not null,
  effective_from date not null,
  effective_to date,
  release_version varchar(64) not null,
  status varchar(16) not null check (status in ('DRAFT', 'ACTIVE', 'RETIRED')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, price_version_id),
  unique (tenant_id, catalog_code, item_code, release_version),
  check (effective_to is null or effective_to >= effective_from)
);

create index price_catalog_active_idx
  on price_catalog_version (tenant_id, item_code)
  where status = 'ACTIVE';

create table charge_item (
  tenant_id uuid not null,
  charge_item_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  item_code varchar(128) not null,
  item_name varchar(256) not null,
  quantity numeric(18,6) not null check (quantity > 0),
  unit_price numeric(18,2) not null check (unit_price >= 0),
  amount numeric(18,2) not null check (amount >= 0),
  unit varchar(32) not null,
  status varchar(16) not null check (status in ('CHARGED', 'REVERSED')),
  charged_at timestamptz not null,
  charged_by uuid not null,
  reversed_at timestamptz,
  reversed_by uuid,
  reverse_reason varchar(1000),
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, charge_item_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, charged_by) references app_user(tenant_id, user_id),
  foreign key (tenant_id, reversed_by) references app_user(tenant_id, user_id),
  check ((status = 'REVERSED') = (reversed_at is not null))
);

create index charge_item_encounter_idx
  on charge_item (tenant_id, encounter_id, status, charged_at desc, charge_item_id desc);

create function prevent_charge_item_price_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'charge item price and amount are immutable once charged';
end $$;

create trigger charge_item_immutable
  before update of item_code, quantity, unit_price, amount, unit, charged_at, charged_by on charge_item
  for each row execute function prevent_charge_item_price_mutation();
