alter table clinical_task drop constraint clinical_task_source_type_check;
alter table clinical_task add constraint clinical_task_source_type_check
  check (source_type in ('ORDER_EXECUTION', 'CRITICAL_VALUE', 'DOCUMENT', 'CONSULTATION',
    'PATHWAY', 'DISCHARGE_REMEDIATION', 'AI_APPROVAL', 'REMINDER'));

create table clinical_reminder_conversion (
  tenant_id uuid not null,
  conversion_id uuid not null,
  reminder_id uuid not null,
  clinical_task_id uuid not null,
  converted_by uuid not null,
  converted_at timestamptz not null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  primary key (tenant_id, conversion_id),
  constraint clinical_reminder_conversion_unique unique (tenant_id, reminder_id),
  foreign key (tenant_id, reminder_id) references clinical_reminder(tenant_id, reminder_id),
  foreign key (tenant_id, clinical_task_id) references clinical_task(tenant_id, task_id),
  foreign key (tenant_id, converted_by) references app_user(tenant_id, user_id)
);

create index clinical_reminder_conversion_task_idx
  on clinical_reminder_conversion (tenant_id, clinical_task_id);

create function prevent_clinical_reminder_conversion_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'clinical reminder conversion is immutable once recorded';
end $$;

create trigger clinical_reminder_conversion_immutable
  before update or delete on clinical_reminder_conversion
  for each row execute function prevent_clinical_reminder_conversion_mutation();
