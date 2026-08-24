create table clinical_order (
  tenant_id uuid not null,
  order_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  order_scope varchar(24) not null check (order_scope in ('LONG_TERM', 'TEMPORARY')),
  status varchar(24) not null check (status in (
    'DRAFT', 'VALIDATING', 'SIGNED', 'ACTIVE', 'IN_PROGRESS', 'COMPLETED',
    'CANCELLED', 'STOPPING', 'STOPPED', 'EXCEPTION')),
  clinical_indication varchar(1000) not null check (length(trim(clinical_indication)) > 0),
  author_user_id uuid not null,
  signed_by uuid,
  signed_at timestamptz,
  rule_watermark varchar(128),
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, order_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, author_user_id) references app_user(tenant_id, user_id),
  foreign key (tenant_id, signed_by) references app_user(tenant_id, user_id),
  check ((signed_at is null) = (signed_by is null)),
  check (status = 'DRAFT' or signed_at is not null)
);

create table clinical_order_item (
  tenant_id uuid not null,
  order_item_id uuid not null,
  order_id uuid not null,
  item_type varchar(24) not null check (item_type in (
    'MEDICATION', 'LAB', 'IMAGING', 'TREATMENT', 'NURSING', 'DIET', 'OTHER')),
  catalog_code varchar(128) not null,
  display_name varchar(256) not null check (length(trim(display_name)) > 0),
  requested_quantity numeric(18,6) not null check (requested_quantity > 0),
  quantity_unit varchar(64) not null check (length(trim(quantity_unit)) > 0),
  instructions varchar(1000),
  item_state varchar(24) not null check (item_state in (
    'DRAFT', 'ACTIVE', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'STOPPED')),
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, order_item_id),
  unique (tenant_id, order_id, catalog_code),
  foreign key (tenant_id, order_id) references clinical_order(tenant_id, order_id)
);

create table order_execution_task (
  tenant_id uuid not null,
  execution_task_id uuid not null,
  order_id uuid not null,
  order_item_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  task_state varchar(24) not null check (task_state in (
    'PENDING', 'ACCEPTED', 'IN_PROGRESS', 'PARTIAL', 'COMPLETED', 'REFUSED', 'CANCELLED')),
  requested_quantity numeric(18,6) not null check (requested_quantity > 0),
  performed_quantity numeric(18,6) not null default 0 check (performed_quantity >= 0),
  quantity_unit varchar(64) not null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, execution_task_id),
  unique (tenant_id, order_item_id),
  foreign key (tenant_id, order_id) references clinical_order(tenant_id, order_id),
  foreign key (tenant_id, order_item_id) references clinical_order_item(tenant_id, order_item_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  check (performed_quantity <= requested_quantity),
  check (task_state <> 'COMPLETED' or performed_quantity = requested_quantity)
);

create table order_execution_event (
  tenant_id uuid not null,
  execution_event_id uuid not null,
  execution_task_id uuid not null,
  order_id uuid not null,
  order_item_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  event_type varchar(24) not null check (event_type in ('PARTIAL', 'COMPLETED')),
  performed_quantity numeric(18,6) not null check (performed_quantity > 0),
  quantity_unit varchar(64) not null,
  note varchar(1000),
  actor_user_id uuid not null,
  occurred_at timestamptz not null default now(),
  primary key (tenant_id, execution_event_id),
  foreign key (tenant_id, execution_task_id) references order_execution_task(tenant_id, execution_task_id),
  foreign key (tenant_id, order_id) references clinical_order(tenant_id, order_id),
  foreign key (tenant_id, order_item_id) references clinical_order_item(tenant_id, order_item_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, actor_user_id) references app_user(tenant_id, user_id)
);

create index clinical_order_encounter_idx
  on clinical_order (tenant_id, encounter_id, status, updated_at desc);
create index order_execution_task_patient_state_idx
  on order_execution_task (tenant_id, patient_id, task_state, updated_at);

create function prevent_execution_event_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'order execution events are immutable';
end $$;

create trigger order_execution_event_immutable
  before update or delete on order_execution_event
  for each row execute function prevent_execution_event_mutation();

