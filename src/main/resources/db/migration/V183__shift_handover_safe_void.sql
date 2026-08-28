alter table shift_handover
  add column voided_at timestamptz,
  add column void_reason varchar(1000),
  add constraint shift_handover_void_pair_check
    check ((voided_at is null) = (void_reason is null)),
  add constraint shift_handover_void_reason_check
    check (void_reason is null or length(trim(void_reason)) >= 4);

create index shift_handover_current_ward_idx
  on shift_handover (tenant_id, ward_id, shift_to desc, handover_id desc)
  where voided_at is null;
