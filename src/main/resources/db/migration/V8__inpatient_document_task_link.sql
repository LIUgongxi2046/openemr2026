alter table inpatient_document_task
  add column working_document_id uuid;

alter table inpatient_document_task
  add constraint inpatient_document_task_working_document_fk
  foreign key (tenant_id, working_document_id)
  references clinical_document(tenant_id, document_id);

create unique index inpatient_document_task_working_document_idx
  on inpatient_document_task (tenant_id, working_document_id)
  where working_document_id is not null;

alter table inpatient_document_task
  add constraint inpatient_document_task_lifecycle_check check (
    (task_state = 'PENDING' and working_document_id is null and completed_document_id is null)
    or (task_state in ('IN_PROGRESS', 'OVERDUE') and working_document_id is not null and completed_document_id is null)
    or (task_state = 'COMPLETED' and working_document_id is not null
        and completed_document_id = working_document_id)
    or (task_state = 'WAIVED' and completed_document_id is null)
  );
