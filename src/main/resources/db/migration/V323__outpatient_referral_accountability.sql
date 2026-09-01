alter table referral
  add column requested_by uuid,
  add column resolved_by uuid,
  add constraint referral_requested_by_fk
    foreign key (tenant_id, requested_by) references app_user(tenant_id, user_id),
  add constraint referral_resolved_by_fk
    foreign key (tenant_id, resolved_by) references app_user(tenant_id, user_id);

create index referral_target_queue_idx
  on referral (tenant_id, facility_id, target_department, status, sent_at desc)
  where referral_type = 'INTERNAL' and status = 'SENT';
