alter table config_item
  drop constraint config_item_tenant_id_config_type_config_key_key;

create unique index config_item_open_version_key_uidx
  on config_item (tenant_id, config_type, config_key)
  where status in ('DRAFT', 'PENDING_APPROVAL', 'APPROVED');

create unique index config_item_active_version_key_uidx
  on config_item (tenant_id, config_type, config_key)
  where status = 'ACTIVE';

create index config_item_version_history_idx
  on config_item (tenant_id, config_type, config_key, updated_at desc, config_id);
