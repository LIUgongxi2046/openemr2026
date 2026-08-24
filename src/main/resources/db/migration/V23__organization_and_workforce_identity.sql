alter table organization
  add column parent_organization_id uuid,
  add column organization_type varchar(32) not null default 'HEALTHCARE_ORGANIZATION'
    check (organization_type in ('GROUP','HEALTHCARE_ORGANIZATION','CLINIC','COMMUNITY_CENTER','OTHER')),
  add column effective_from timestamptz,
  add column effective_until timestamptz,
  add column row_version bigint not null default 1 check (row_version > 0),
  add column updated_at timestamptz not null default now();

update organization set effective_from = '-infinity'::timestamptz where effective_from is null;

alter table organization
  alter column effective_from set not null,
  alter column effective_from set default now(),
  add constraint organization_parent_fk
    foreign key (tenant_id, parent_organization_id) references organization(tenant_id, organization_id),
  add constraint organization_effective_period_check
    check (effective_until is null or effective_until > effective_from),
  add constraint organization_not_self_parent_check
    check (parent_organization_id is null or parent_organization_id <> organization_id);

create or replace function prevent_organization_cycle()
returns trigger
language plpgsql
as $body$
begin
  if new.parent_organization_id is null then
    return new;
  end if;
  if exists (
    with recursive ancestors(organization_id, parent_organization_id) as (
      select organization_id, parent_organization_id
      from organization
      where tenant_id = new.tenant_id and organization_id = new.parent_organization_id
      union all
      select parent.organization_id, parent.parent_organization_id
      from organization parent
      join ancestors child on child.parent_organization_id = parent.organization_id
      where parent.tenant_id = new.tenant_id
    )
    select 1 from ancestors where organization_id = new.organization_id
  ) then
    raise exception 'organization hierarchy cycle is not allowed' using errcode = '23514';
  end if;
  return new;
end
$body$;

create trigger organization_cycle_guard
before insert or update of parent_organization_id on organization
for each row execute function prevent_organization_cycle();

alter table facility
  add column effective_from timestamptz,
  add column effective_until timestamptz,
  add column row_version bigint not null default 1 check (row_version > 0),
  add column updated_at timestamptz not null default now();

update facility set effective_from = '-infinity'::timestamptz where effective_from is null;

alter table facility
  alter column effective_from set not null,
  alter column effective_from set default now(),
  add constraint facility_effective_period_check
    check (effective_until is null or effective_until > effective_from);

alter table clinical_department
  add column parent_department_id uuid,
  add column unit_type varchar(32) not null default 'DEPARTMENT'
    check (unit_type in ('DEPARTMENT','NURSING_UNIT','MEDICAL_TECH','ADMINISTRATIVE','OTHER')),
  add column effective_from timestamptz,
  add column effective_until timestamptz,
  add column row_version bigint not null default 1 check (row_version > 0),
  add column created_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now();

update clinical_department set effective_from = '-infinity'::timestamptz where effective_from is null;

alter table clinical_department
  alter column effective_from set not null,
  alter column effective_from set default now(),
  add constraint clinical_department_parent_fk
    foreign key (tenant_id, facility_id, parent_department_id)
    references clinical_department(tenant_id, facility_id, department_id),
  add constraint clinical_department_effective_period_check
    check (effective_until is null or effective_until > effective_from),
  add constraint clinical_department_not_self_parent_check
    check (parent_department_id is null or parent_department_id <> department_id);

create or replace function prevent_clinical_department_cycle()
returns trigger
language plpgsql
as $body$
begin
  if new.parent_department_id is null then
    return new;
  end if;
  if exists (
    with recursive ancestors(department_id, parent_department_id) as (
      select department_id, parent_department_id
      from clinical_department
      where tenant_id = new.tenant_id and facility_id = new.facility_id
        and department_id = new.parent_department_id
      union all
      select parent.department_id, parent.parent_department_id
      from clinical_department parent
      join ancestors child on child.parent_department_id = parent.department_id
      where parent.tenant_id = new.tenant_id and parent.facility_id = new.facility_id
    )
    select 1 from ancestors where department_id = new.department_id
  ) then
    raise exception 'department hierarchy cycle is not allowed' using errcode = '23514';
  end if;
  return new;
end
$body$;

create trigger clinical_department_cycle_guard
before insert or update of parent_department_id on clinical_department
for each row execute function prevent_clinical_department_cycle();

alter table clinical_ward
  add column department_id uuid,
  add column effective_from timestamptz,
  add column effective_until timestamptz,
  add column row_version bigint not null default 1 check (row_version > 0),
  add column updated_at timestamptz not null default now();

with ward_facility as (
  select distinct tenant_id, facility_id,
    md5(tenant_id::text || ':' || facility_id::text || ':migrated-ward-department') as hash
  from clinical_ward
), migrated_department as (
  select tenant_id, facility_id,
    (substr(hash, 1, 8) || '-' || substr(hash, 9, 4) || '-' || substr(hash, 13, 4) || '-'
      || substr(hash, 17, 4) || '-' || substr(hash, 21, 12))::uuid as department_id
  from ward_facility
)
insert into clinical_department(
  tenant_id, facility_id, department_id, department_code, display_name, status,
  unit_type, effective_from)
select tenant_id, facility_id, department_id,
  'MIGRATED-WARD-' || upper(substr(replace(facility_id::text, '-', ''), 1, 8)),
  '迁移病区归属单元（待管理员校正）', 'ACTIVE', 'NURSING_UNIT', '-infinity'::timestamptz
from migrated_department
on conflict (tenant_id, facility_id, department_id) do nothing;

with ward_facility as (
  select distinct tenant_id, facility_id,
    md5(tenant_id::text || ':' || facility_id::text || ':migrated-ward-department') as hash
  from clinical_ward
), migrated_department as (
  select tenant_id, facility_id,
    (substr(hash, 1, 8) || '-' || substr(hash, 9, 4) || '-' || substr(hash, 13, 4) || '-'
      || substr(hash, 17, 4) || '-' || substr(hash, 21, 12))::uuid as department_id
  from ward_facility
)
update clinical_ward ward
set department_id = migrated.department_id,
  effective_from = '-infinity'::timestamptz
from migrated_department migrated
where ward.tenant_id = migrated.tenant_id and ward.facility_id = migrated.facility_id;

alter table clinical_ward
  alter column department_id set not null,
  alter column effective_from set not null,
  alter column effective_from set default now(),
  add constraint clinical_ward_facility_department_ward_uk
    unique (tenant_id, facility_id, department_id, ward_id),
  add constraint clinical_ward_department_fk
    foreign key (tenant_id, facility_id, department_id)
    references clinical_department(tenant_id, facility_id, department_id),
  add constraint clinical_ward_effective_period_check
    check (effective_until is null or effective_until > effective_from);

alter table clinical_bed
  add column effective_from timestamptz,
  add column effective_until timestamptz,
  add column row_version bigint not null default 1 check (row_version > 0),
  add column updated_at timestamptz not null default now();

update clinical_bed set effective_from = '-infinity'::timestamptz where effective_from is null;

alter table clinical_bed
  alter column effective_from set not null,
  alter column effective_from set default now(),
  add constraint clinical_bed_effective_period_check
    check (effective_until is null or effective_until > effective_from);

create index organization_effective_idx
  on organization (tenant_id, status, effective_from, effective_until);
create index facility_effective_idx
  on facility (tenant_id, organization_id, status, effective_from, effective_until);
create index clinical_department_hierarchy_idx
  on clinical_department (tenant_id, facility_id, parent_department_id, status, effective_from, effective_until);
create index clinical_ward_department_idx
  on clinical_ward (tenant_id, facility_id, department_id, status, effective_from, effective_until);
create index clinical_bed_effective_idx
  on clinical_bed (tenant_id, ward_id, status, effective_from, effective_until);

create table workforce_person (
  tenant_id uuid not null,
  person_id uuid not null,
  person_code varchar(96),
  display_name varchar(256) not null check (length(trim(display_name)) > 0),
  status varchar(24) not null check (status in ('ACTIVE','INACTIVE','RETIRED','DECEASED')),
  effective_from timestamptz not null default now(),
  effective_until timestamptz,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, person_id),
  foreign key (tenant_id) references tenant(tenant_id),
  check (effective_until is null or effective_until > effective_from)
);

create unique index workforce_person_code_uk
  on workforce_person (tenant_id, person_code) where person_code is not null;
create index workforce_person_effective_idx
  on workforce_person (tenant_id, status, effective_from, effective_until);

insert into workforce_person(
  tenant_id, person_id, person_code, display_name, status, effective_from)
select tenant_id, user_id, 'MIGRATED-' || upper(replace(user_id::text, '-', '')),
  display_name,
  case when status = 'ACTIVE' then 'ACTIVE' else 'INACTIVE' end,
  '-infinity'::timestamptz
from app_user;

alter table app_user add column person_id uuid;
update app_user set person_id = user_id where person_id is null;
alter table app_user
  alter column person_id set not null,
  add constraint app_user_person_fk
    foreign key (tenant_id, person_id) references workforce_person(tenant_id, person_id),
  add constraint app_user_identity_person_uk unique (tenant_id, user_id, person_id);

create or replace function populate_account_person()
returns trigger
language plpgsql
as $body$
begin
  if new.person_id is null then
    new.person_id := new.user_id;
    insert into workforce_person(
      tenant_id, person_id, person_code, display_name, status, effective_from)
    values (
      new.tenant_id, new.user_id, 'MIGRATED-' || upper(replace(new.user_id::text, '-', '')),
      new.display_name, case when new.status = 'ACTIVE' then 'ACTIVE' else 'INACTIVE' end, now())
    on conflict (tenant_id, person_id) do nothing;
  end if;
  return new;
end
$body$;

create trigger app_user_person_compatibility
before insert on app_user
for each row execute function populate_account_person();

alter table role_assignment add column person_id uuid;
update role_assignment assignment
set person_id = account.person_id
from app_user account
where account.tenant_id = assignment.tenant_id and account.user_id = assignment.user_id;
alter table role_assignment
  alter column person_id set not null,
  add constraint role_assignment_account_person_fk
    foreign key (tenant_id, user_id, person_id)
    references app_user(tenant_id, user_id, person_id);

create or replace function populate_role_assignment_person()
returns trigger
language plpgsql
as $body$
begin
  if new.person_id is null then
    select person_id into new.person_id
    from app_user
    where tenant_id = new.tenant_id and user_id = new.user_id;
  end if;
  if new.person_id is null then
    raise exception 'role assignment person binding is required' using errcode = '23514';
  end if;
  return new;
end
$body$;

create trigger role_assignment_person_compatibility
before insert or update of user_id, person_id on role_assignment
for each row execute function populate_role_assignment_person();

create table workforce_assignment (
  tenant_id uuid not null,
  workforce_assignment_id uuid not null,
  source_role_assignment_id uuid,
  person_id uuid not null,
  organization_id uuid not null,
  facility_id uuid,
  department_id uuid,
  ward_id uuid,
  position_code varchar(96) not null check (length(trim(position_code)) > 0),
  status varchar(24) not null check (status in ('ACTIVE','SUSPENDED','ENDED')),
  valid_from timestamptz not null,
  valid_until timestamptz,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, workforce_assignment_id),
  unique (tenant_id, source_role_assignment_id),
  foreign key (tenant_id, person_id) references workforce_person(tenant_id, person_id),
  foreign key (tenant_id, organization_id) references organization(tenant_id, organization_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, facility_id, department_id)
    references clinical_department(tenant_id, facility_id, department_id),
  foreign key (tenant_id, facility_id, department_id, ward_id)
    references clinical_ward(tenant_id, facility_id, department_id, ward_id),
  foreign key (tenant_id, source_role_assignment_id)
    references role_assignment(tenant_id, role_assignment_id) on delete cascade,
  check (valid_until is null or valid_until > valid_from),
  check (department_id is null or facility_id is not null),
  check (ward_id is null or department_id is not null)
);

insert into workforce_assignment(
  tenant_id, workforce_assignment_id, source_role_assignment_id, person_id, organization_id, facility_id,
  position_code, status, valid_from, valid_until)
select tenant_id, role_assignment_id, role_assignment_id, person_id, organization_id, facility_id,
  role_code,
  case status when 'ACTIVE' then 'ACTIVE' when 'SUSPENDED' then 'SUSPENDED' else 'ENDED' end,
  valid_from, valid_until
from role_assignment;

create or replace function synchronize_role_workforce_assignment()
returns trigger
language plpgsql
as $body$
begin
  insert into workforce_assignment(
    tenant_id, workforce_assignment_id, source_role_assignment_id, person_id,
    organization_id, facility_id, position_code, status, valid_from, valid_until)
  values (
    new.tenant_id, new.role_assignment_id, new.role_assignment_id, new.person_id,
    new.organization_id, new.facility_id, new.role_code,
    case new.status when 'ACTIVE' then 'ACTIVE' when 'SUSPENDED' then 'SUSPENDED' else 'ENDED' end,
    new.valid_from, new.valid_until)
  on conflict (tenant_id, source_role_assignment_id) do update
    set person_id = excluded.person_id,
      organization_id = excluded.organization_id,
      facility_id = excluded.facility_id,
      position_code = excluded.position_code,
      status = excluded.status,
      valid_from = excluded.valid_from,
      valid_until = excluded.valid_until,
      row_version = workforce_assignment.row_version + 1,
      updated_at = now();
  return new;
end
$body$;

create trigger role_assignment_workforce_sync
after insert or update of person_id, organization_id, facility_id, role_code, status, valid_from, valid_until
on role_assignment
for each row execute function synchronize_role_workforce_assignment();

create index workforce_assignment_scope_idx
  on workforce_assignment(
    tenant_id, person_id, organization_id, facility_id, department_id, ward_id,
    status, valid_from, valid_until);

create table practitioner_credential (
  tenant_id uuid not null,
  credential_id uuid not null,
  person_id uuid not null,
  credential_type varchar(40) not null
    check (credential_type in ('PHYSICIAN_LICENSE','NURSE_LICENSE','PHARMACIST_LICENSE','TECHNICIAN_LICENSE','OTHER')),
  registration_number varchar(128) not null check (length(trim(registration_number)) > 0),
  issuing_authority varchar(256) not null check (length(trim(issuing_authority)) > 0),
  practice_scope jsonb not null default '{}'::jsonb,
  status varchar(24) not null check (status in ('ACTIVE','SUSPENDED','EXPIRED','REVOKED')),
  valid_from timestamptz not null,
  valid_until timestamptz,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, credential_id),
  unique (tenant_id, credential_type, issuing_authority, registration_number),
  foreign key (tenant_id, person_id) references workforce_person(tenant_id, person_id),
  check (valid_until is null or valid_until > valid_from)
);

create index practitioner_credential_person_idx
  on practitioner_credential(tenant_id, person_id, status, valid_from, valid_until);

alter table signature_evidence
  add column signer_person_id uuid,
  add column signer_display_name varchar(256);

update signature_evidence signature
set signer_person_id = account.person_id,
  signer_display_name = person.display_name
from app_user account
join workforce_person person
  on person.tenant_id = account.tenant_id and person.person_id = account.person_id
where account.tenant_id = signature.tenant_id and account.user_id = signature.signer_user_id;

alter table signature_evidence
  alter column signer_person_id set not null,
  alter column signer_display_name set not null,
  add constraint signature_evidence_signer_person_fk
    foreign key (tenant_id, signer_person_id) references workforce_person(tenant_id, person_id);

create or replace function populate_signature_person_snapshot()
returns trigger
language plpgsql
as $body$
begin
  if new.signer_person_id is null or new.signer_display_name is null then
    select account.person_id, person.display_name
    into new.signer_person_id, new.signer_display_name
    from app_user account
    join workforce_person person
      on person.tenant_id = account.tenant_id and person.person_id = account.person_id
    where account.tenant_id = new.tenant_id and account.user_id = new.signer_user_id;
  end if;
  if new.signer_person_id is null or new.signer_display_name is null then
    raise exception 'signature signer person snapshot is required' using errcode = '23514';
  end if;
  return new;
end
$body$;

create trigger signature_person_snapshot
before insert on signature_evidence
for each row execute function populate_signature_person_snapshot();
