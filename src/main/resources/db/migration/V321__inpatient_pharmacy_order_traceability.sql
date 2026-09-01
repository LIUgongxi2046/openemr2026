alter table pharmacy_dispensing
  add column order_id uuid,
  add column order_item_id uuid;

alter table pharmacy_dispensing
  add constraint pharmacy_dispensing_order_pair_check
    check ((order_id is null) = (order_item_id is null)),
  add constraint pharmacy_dispensing_order_fk
    foreign key (tenant_id, order_id) references clinical_order(tenant_id, order_id),
  add constraint pharmacy_dispensing_order_item_fk
    foreign key (tenant_id, order_item_id) references clinical_order_item(tenant_id, order_item_id);

create index pharmacy_dispensing_order_item_idx
  on pharmacy_dispensing (tenant_id, order_item_id, prepared_at desc)
  where order_item_id is not null;
