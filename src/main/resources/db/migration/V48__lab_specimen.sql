create table lab_specimen (
  tenant_id uuid not null,
  specimen_id uuid not null,
  order_id uuid not null,
  order_item_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  specimen_type varchar(64) not null check (specimen_type in ('BLOOD', 'URINE', 'STOOL', 'TISSUE', 'SWAB', 'OTHER')),
  collection_status varchar(24) not null check (collection_status in ('ORDERED', 'COLLECTED', 'RECEIVED', 'REJECTED')),
  collected_at timestamptz,
  collected_by uuid,
  received_at timestamptz,
  received_by uuid,
  rejection_reason varchar(1000),
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, specimen_id),
  unique (tenant_id, order_item_id),
  foreign key (tenant_id, order_id) references clinical_order(tenant_id, order_id),
  foreign key (tenant_id, order_item_id) references clinical_order_item(tenant_id, order_item_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, collected_by) references app_user(tenant_id, user_id),
  foreign key (tenant_id, received_by) references app_user(tenant_id, user_id),
  check ((collection_status in ('COLLECTED', 'RECEIVED')) = (collected_at is not null)),
  check (collection_status <> 'REJECTED' or rejection_reason is not null)
);

create index lab_specimen_encounter_idx
  on lab_specimen (tenant_id, encounter_id, collection_status, created_at desc, specimen_id desc);

create function prevent_lab_specimen_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'lab specimen identity is immutable once created';
end $$;

create trigger lab_specimen_immutable
  before update of order_id, order_item_id, patient_id, encounter_id, specimen_type on lab_specimen
  for each row execute function prevent_lab_specimen_mutation();
