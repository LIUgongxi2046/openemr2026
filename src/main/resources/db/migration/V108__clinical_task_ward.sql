alter table clinical_task add column ward_id uuid;

create index clinical_task_ward_idx
  on clinical_task (tenant_id, ward_id, state, due_at)
  where ward_id is not null;

alter table clinical_task
  add constraint clinical_task_ward_fk
  foreign key (tenant_id, ward_id) references clinical_ward(tenant_id, ward_id);
