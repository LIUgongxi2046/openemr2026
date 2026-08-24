create table config_item (
  tenant_id uuid not null,
  config_id uuid not null,
  config_type varchar(64) not null,
  config_key varchar(128) not null,
  display_name varchar(256) not null,
  payload jsonb not null default '{}'::jsonb,
  status varchar(24) not null default 'DRAFT',
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  primary key (tenant_id, config_id),
  unique (tenant_id, config_type, config_key),
  foreign key (tenant_id) references tenant(tenant_id),
  constraint config_item_status_check check (status in ('DRAFT', 'ACTIVE', 'ARCHIVED')),
  constraint config_item_row_version_check check (row_version > 0)
);

create index config_item_type_idx on config_item (tenant_id, config_type, status);
