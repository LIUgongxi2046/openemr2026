create table authorization_policy (
  tenant_id uuid not null,
  policy_id uuid not null,
  policy_code varchar(128) not null,
  version_no integer not null check (version_no > 0),
  effect varchar(16) not null check (effect in ('ALLOW', 'DENY')),
  status varchar(24) not null check (status in ('DRAFT', 'PUBLISHED', 'RETIRED')),
  subject_role_code varchar(96),
  resource_type varchar(96) not null,
  action_code varchar(96) not null,
  organization_id uuid,
  facility_id uuid,
  department_id uuid,
  ward_id uuid,
  patient_relationship_required boolean not null default false,
  relationship_types text[] not null default '{}',
  resource_statuses text[] not null default '{}',
  purpose_codes text[] not null default '{}',
  emergency_override_allowed boolean not null default true,
  priority integer not null default 100 check (priority between 0 and 10000),
  valid_from timestamptz not null,
  valid_until timestamptz,
  created_by uuid not null,
  approved_by uuid,
  published_at timestamptz,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, policy_id),
  unique (tenant_id, policy_code, version_no),
  foreign key (tenant_id, organization_id) references organization(tenant_id, organization_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, facility_id, department_id)
    references clinical_department(tenant_id, facility_id, department_id),
  foreign key (tenant_id, ward_id) references clinical_ward(tenant_id, ward_id),
  foreign key (tenant_id, created_by) references app_user(tenant_id, user_id),
  foreign key (tenant_id, approved_by) references app_user(tenant_id, user_id),
  check (valid_until is null or valid_until > valid_from),
  check (approved_by is null or approved_by <> created_by),
  check ((status = 'PUBLISHED') = (approved_by is not null and published_at is not null)),
  check (not patient_relationship_required or cardinality(relationship_types) > 0)
);

create unique index authorization_policy_published_uk
  on authorization_policy(tenant_id, policy_code) where status = 'PUBLISHED';
create index authorization_policy_runtime_idx
  on authorization_policy(tenant_id, resource_type, action_code, status, priority desc);

create table patient_care_relationship (
  tenant_id uuid not null,
  patient_relationship_id uuid not null,
  patient_id uuid not null,
  user_id uuid not null,
  role_assignment_id uuid not null,
  encounter_id uuid,
  relationship_type varchar(48) not null check (relationship_type in ('CARE_TEAM', 'REGISTRAR', 'CONSULTANT', 'NURSING_TEAM', 'EMERGENCY')),
  status varchar(24) not null check (status in ('ACTIVE', 'ENDED', 'REVOKED')),
  valid_from timestamptz not null,
  valid_until timestamptz,
  created_by uuid not null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, patient_relationship_id),
  unique (tenant_id, patient_id, role_assignment_id, encounter_id, relationship_type),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, user_id) references app_user(tenant_id, user_id),
  foreign key (tenant_id, role_assignment_id) references role_assignment(tenant_id, role_assignment_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, created_by) references app_user(tenant_id, user_id),
  check (valid_until is null or valid_until > valid_from)
);

create index patient_care_relationship_runtime_idx
  on patient_care_relationship(tenant_id, patient_id, user_id, status, valid_until);

create table emergency_access_grant (
  tenant_id uuid not null,
  emergency_access_grant_id uuid not null,
  user_id uuid not null,
  role_assignment_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid,
  resource_types text[] not null check (cardinality(resource_types) > 0),
  action_codes text[] not null check (cardinality(action_codes) > 0),
  reason varchar(1000) not null check (length(trim(reason)) >= 10),
  status varchar(24) not null check (status in ('ACTIVE', 'EXPIRED', 'REVOKED', 'REVIEWED')),
  requested_at timestamptz not null,
  expires_at timestamptz not null,
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_outcome varchar(32) check (review_outcome in ('APPROPRIATE', 'INAPPROPRIATE', 'ESCALATED')),
  review_note varchar(1000),
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, emergency_access_grant_id),
  foreign key (tenant_id, user_id) references app_user(tenant_id, user_id),
  foreign key (tenant_id, role_assignment_id) references role_assignment(tenant_id, role_assignment_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, reviewed_by) references app_user(tenant_id, user_id),
  check (expires_at > requested_at and expires_at <= requested_at + interval '60 minutes'),
  check (reviewed_by is null or reviewed_by <> user_id),
  check ((status = 'REVIEWED') = (reviewed_by is not null and reviewed_at is not null and review_outcome is not null))
);

create index emergency_access_runtime_idx
  on emergency_access_grant(tenant_id, patient_id, user_id, status, expires_at);

create function expire_emergency_access_grants()
returns trigger
language plpgsql
as $body$
begin
  update emergency_access_grant
  set status = 'EXPIRED', row_version = row_version + 1, updated_at = now()
  where tenant_id = new.tenant_id and user_id = new.user_id
    and status = 'ACTIVE' and expires_at <= now();
  return new;
end
$body$;

create trigger emergency_access_expiry_sweep
before insert on emergency_access_grant
for each row execute function expire_emergency_access_grants();
