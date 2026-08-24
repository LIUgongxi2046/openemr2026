alter table config_item
  drop constraint config_item_status_check;

alter table config_item
  add column schema_version integer not null default 1,
  add column validation_state varchar(24) not null default 'NOT_VALIDATED',
  add column validation_errors jsonb not null default '[]'::jsonb,
  add column approval_state varchar(24) not null default 'DRAFT',
  add column approved_by uuid,
  add column published_at timestamptz,
  add constraint config_item_status_check
    check (status in ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'ARCHIVED')),
  add constraint config_item_schema_version_check check (schema_version > 0),
  add constraint config_item_validation_state_check
    check (validation_state in ('NOT_VALIDATED', 'VALID', 'INVALID')),
  add constraint config_item_approval_state_check
    check (approval_state in ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED')),
  add constraint config_item_approval_actor_check
    check ((approval_state = 'APPROVED') = (approved_by is not null)),
  add foreign key (tenant_id, approved_by) references app_user(tenant_id, user_id);

update config_item
set published_at = updated_at
where status = 'ACTIVE';

alter table config_item
  add constraint config_item_publish_state_check
    check ((status = 'ACTIVE') = (published_at is not null));

create table config_item_revision (
  tenant_id uuid not null,
  config_id uuid not null,
  revision_no bigint not null,
  display_name varchar(256) not null,
  payload jsonb not null,
  schema_version integer not null,
  status varchar(24) not null,
  validation_state varchar(24) not null,
  validation_errors jsonb not null,
  approval_state varchar(24) not null,
  changed_by uuid,
  change_reason varchar(500),
  created_at timestamptz not null default now(),
  primary key (tenant_id, config_id, revision_no),
  foreign key (tenant_id, config_id) references config_item(tenant_id, config_id),
  foreign key (tenant_id, changed_by) references app_user(tenant_id, user_id),
  check (revision_no > 0),
  check (schema_version > 0)
);

insert into config_item_revision(
  tenant_id, config_id, revision_no, display_name, payload, schema_version,
  status, validation_state, validation_errors, approval_state, changed_by,
  change_reason, created_at)
select tenant_id, config_id, row_version, display_name, payload, 1,
       status, 'NOT_VALIDATED', '[]'::jsonb, 'DRAFT', created_by,
       'V166 lifecycle baseline', updated_at
from config_item;

create index config_item_revision_history_idx
  on config_item_revision(tenant_id, config_id, revision_no desc);
