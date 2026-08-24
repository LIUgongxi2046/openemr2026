create table clinical_reminder (
  tenant_id uuid not null,
  reminder_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  reminder_type varchar(32) not null check (reminder_type in (
    'DRUG_INTERACTION', 'OVERDUE_TASK', 'CRITICAL_VALUE', 'ABNORMAL_VITAL', 'FOLLOWUP_DUE', 'OTHER')),
  message varchar(2000) not null check (length(trim(message)) >= 4),
  severity varchar(16) not null check (severity in ('INFO', 'WARNING', 'CRITICAL')),
  status varchar(16) not null check (status in ('PENDING', 'ACKNOWLEDGED', 'SILENCED')),
  source_task_id uuid,
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  silenced_at timestamptz,
  silenced_by uuid,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, reminder_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, source_task_id) references clinical_task(tenant_id, task_id),
  foreign key (tenant_id, acknowledged_by) references app_user(tenant_id, user_id),
  foreign key (tenant_id, silenced_by) references app_user(tenant_id, user_id)
);

create index clinical_reminder_encounter_idx
  on clinical_reminder (tenant_id, encounter_id, status, severity, created_at desc, reminder_id desc);

create function prevent_clinical_reminder_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'clinical reminder content is immutable once created';
end $$;

create trigger clinical_reminder_immutable
  before update of patient_id, encounter_id, reminder_type, message, severity on clinical_reminder
  for each row execute function prevent_clinical_reminder_mutation();
