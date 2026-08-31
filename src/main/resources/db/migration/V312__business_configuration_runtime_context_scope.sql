alter table configuration_runtime_execution
  add column organization_id uuid,
  add column facility_id uuid,
  add column patient_id uuid,
  add column encounter_id uuid;

with execution_scope as (
  select distinct on (execution.tenant_id, execution.execution_id)
    execution.tenant_id, execution.execution_id, assignment.organization_id,
    coalesce(assignment.facility_id, facility.facility_id) as facility_id
  from configuration_runtime_execution execution
  join role_assignment assignment on assignment.tenant_id = execution.tenant_id
    and assignment.user_id = execution.executed_by
  left join lateral (
    select candidate.facility_id
    from facility candidate
    where candidate.tenant_id = assignment.tenant_id
      and candidate.organization_id = assignment.organization_id
      and candidate.status = 'ACTIVE'
    order by candidate.facility_id
    limit 1
  ) facility on true
  where assignment.status = 'ACTIVE'
    and assignment.valid_from <= execution.created_at
    and (assignment.valid_until is null or assignment.valid_until > execution.created_at)
  order by execution.tenant_id, execution.execution_id,
    (assignment.facility_id is not null) desc, assignment.role_assignment_id
)
update configuration_runtime_execution execution
set organization_id = scope.organization_id,
    facility_id = scope.facility_id
from execution_scope scope
where execution.tenant_id = scope.tenant_id
  and execution.execution_id = scope.execution_id
  and execution.organization_id is null;

alter table configuration_runtime_execution
  alter column organization_id set not null,
  alter column facility_id set not null,
  add constraint configuration_runtime_execution_organization_fk
    foreign key (tenant_id, organization_id) references organization(tenant_id, organization_id),
  add constraint configuration_runtime_execution_facility_fk
    foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  add constraint configuration_runtime_execution_patient_fk
    foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  add constraint configuration_runtime_execution_encounter_fk
    foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id);

create index configuration_runtime_execution_context_idx
  on configuration_runtime_execution(
    tenant_id, organization_id, facility_id, patient_id, encounter_id, created_at desc, execution_id);
