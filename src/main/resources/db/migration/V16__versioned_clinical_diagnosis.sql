create table diagnosis_terminology_entry (
  terminology_system varchar(64) not null,
  terminology_release varchar(64) not null,
  code varchar(128) not null,
  display_name varchar(256) not null check (length(trim(display_name)) > 0),
  lifecycle_status varchar(16) not null check (lifecycle_status in ('ACTIVE', 'RETIRED')),
  effective_from date not null,
  effective_to date,
  primary key (terminology_system, terminology_release, code),
  check (effective_to is null or effective_to >= effective_from)
);

insert into diagnosis_terminology_entry(
  terminology_system, terminology_release, code, display_name, lifecycle_status, effective_from, effective_to)
values
  ('ICD-10-CN', '2026A', 'I10.0', '原发性高血压', 'RETIRED', date '2026-01-01', date '2026-06-30'),
  ('ICD-10-CN', '2026A', 'I10.9', '高血压', 'RETIRED', date '2026-01-01', date '2026-06-30'),
  ('ICD-10-CN', '2026B', 'I10.0', '原发性高血压（更新术语）', 'ACTIVE', date '2026-07-01', null),
  ('ICD-10-CN', '2026B', 'I10.9', '高血压病', 'ACTIVE', date '2026-07-01', null);

create table clinical_diagnosis (
  tenant_id uuid not null,
  diagnosis_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  lifecycle_status varchar(16) not null check (lifecycle_status in ('ACTIVE', 'STOPPED')),
  current_diagnosis_role varchar(24) not null check (current_diagnosis_role in ('PRIMARY', 'SECONDARY', 'DIFFERENTIAL')),
  current_version_id uuid not null,
  author_user_id uuid not null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, diagnosis_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, author_user_id) references app_user(tenant_id, user_id)
);

create unique index clinical_diagnosis_one_active_primary_idx
  on clinical_diagnosis (tenant_id, encounter_id)
  where lifecycle_status = 'ACTIVE' and current_diagnosis_role = 'PRIMARY';

create index clinical_diagnosis_encounter_idx
  on clinical_diagnosis (tenant_id, encounter_id, lifecycle_status, updated_at desc);

create table clinical_diagnosis_version (
  tenant_id uuid not null,
  diagnosis_version_id uuid not null,
  diagnosis_id uuid not null,
  version_no bigint not null check (version_no > 0),
  terminology_system varchar(64) not null,
  terminology_release varchar(64) not null,
  code varchar(128) not null,
  code_display_snapshot varchar(256) not null,
  diagnosis_text varchar(1000) not null check (length(trim(diagnosis_text)) > 0),
  diagnosis_role varchar(24) not null check (diagnosis_role in ('PRIMARY', 'SECONDARY', 'DIFFERENTIAL')),
  certainty varchar(24) not null check (certainty in ('PROVISIONAL', 'CONFIRMED')),
  evidence_summary varchar(2000),
  plan_summary varchar(2000),
  effective_at timestamptz not null,
  change_type varchar(24) not null check (change_type in ('CREATED', 'CONFIRMED', 'CORRECTED')),
  correction_reason varchar(1000),
  supersedes_version_id uuid,
  authored_by uuid not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, diagnosis_version_id),
  unique (tenant_id, diagnosis_id, version_no),
  foreign key (tenant_id, diagnosis_id) references clinical_diagnosis(tenant_id, diagnosis_id),
  foreign key (terminology_system, terminology_release, code)
    references diagnosis_terminology_entry(terminology_system, terminology_release, code),
  foreign key (tenant_id, supersedes_version_id)
    references clinical_diagnosis_version(tenant_id, diagnosis_version_id),
  foreign key (tenant_id, authored_by) references app_user(tenant_id, user_id),
  check ((change_type = 'CORRECTED') = (correction_reason is not null)),
  check (correction_reason is null or length(trim(correction_reason)) > 0)
);

alter table clinical_diagnosis add constraint clinical_diagnosis_current_version_fk
  foreign key (tenant_id, current_version_id)
  references clinical_diagnosis_version(tenant_id, diagnosis_version_id)
  deferrable initially deferred;

create table diagnosis_control_event (
  tenant_id uuid not null,
  diagnosis_control_event_id uuid not null,
  diagnosis_id uuid not null,
  previous_status varchar(24) not null,
  resulting_status varchar(24) not null check (resulting_status = 'STOPPED'),
  reason varchar(1000) not null check (length(trim(reason)) > 0),
  actor_user_id uuid not null,
  occurred_at timestamptz not null default now(),
  primary key (tenant_id, diagnosis_control_event_id),
  foreign key (tenant_id, diagnosis_id) references clinical_diagnosis(tenant_id, diagnosis_id),
  foreign key (tenant_id, actor_user_id) references app_user(tenant_id, user_id)
);

create function prevent_diagnosis_fact_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'diagnosis versions and control events are immutable';
end $$;

create trigger clinical_diagnosis_version_immutable
  before update or delete on clinical_diagnosis_version
  for each row execute function prevent_diagnosis_fact_mutation();

create trigger diagnosis_control_event_immutable
  before update or delete on diagnosis_control_event
  for each row execute function prevent_diagnosis_fact_mutation();
