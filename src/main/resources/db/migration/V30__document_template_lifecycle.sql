set constraints all immediate;

create table clinical_document_template (
  tenant_id uuid not null,
  template_id uuid not null,
  template_code varchar(128) not null,
  display_name varchar(256) not null check (length(trim(display_name)) > 0),
  document_type_code varchar(96) not null,
  organization_id uuid,
  facility_id uuid,
  department_id uuid,
  lifecycle_status varchar(24) not null default 'ACTIVE'
    check (lifecycle_status in ('ACTIVE', 'INACTIVE')),
  created_by uuid not null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, template_id),
  unique (tenant_id, template_code),
  foreign key (tenant_id, organization_id) references organization(tenant_id, organization_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, facility_id, department_id)
    references clinical_department(tenant_id, facility_id, department_id),
  foreign key (tenant_id, created_by) references app_user(tenant_id, user_id),
  check (department_id is null or facility_id is not null)
);

create unique index clinical_document_template_scope_uk
  on clinical_document_template(
    tenant_id, document_type_code,
    coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(facility_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(department_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where lifecycle_status = 'ACTIVE';

create table clinical_document_template_version (
  tenant_id uuid not null,
  template_id uuid not null,
  template_version_id uuid not null,
  version_no integer not null check (version_no > 0),
  status varchar(24) not null check (status in ('DRAFT', 'PUBLISHED', 'RETIRED')),
  section_schema jsonb not null,
  required_fields text[] not null default '{}',
  display_rules jsonb not null default '{}',
  effective_from timestamptz,
  effective_until timestamptz,
  created_by uuid not null,
  approved_by uuid,
  published_at timestamptz,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, template_id, template_version_id),
  unique (tenant_id, template_version_id),
  unique (tenant_id, template_id, version_no),
  foreign key (tenant_id, template_id)
    references clinical_document_template(tenant_id, template_id),
  foreign key (tenant_id, created_by) references app_user(tenant_id, user_id),
  foreign key (tenant_id, approved_by) references app_user(tenant_id, user_id),
  check (jsonb_typeof(section_schema) = 'object'),
  check (jsonb_typeof(display_rules) = 'object'),
  check (effective_until is null or (effective_from is not null and effective_until > effective_from)),
  check ((status = 'DRAFT') = (approved_by is null and published_at is null and effective_from is null)
    or status in ('PUBLISHED', 'RETIRED')),
  check (status = 'DRAFT' or (approved_by is not null and published_at is not null and effective_from is not null)),
  constraint clinical_document_template_version_approver_separation_ck
    check (approved_by is null or approved_by <> created_by
      or (display_rules ->> 'legacy_baseline')::boolean is true)
);

create unique index clinical_document_template_published_uk
  on clinical_document_template_version(tenant_id, template_id)
  where status = 'PUBLISHED';

create index clinical_document_template_resolve_idx
  on clinical_document_template(
    tenant_id, document_type_code, organization_id, facility_id, department_id, lifecycle_status);

create function protect_document_template_version()
returns trigger
language plpgsql
as $body$
begin
  if tg_op = 'DELETE' then
    raise exception 'document template versions are immutable' using errcode = '23514';
  end if;
  if old.status <> 'DRAFT' and (
      new.template_id is distinct from old.template_id
      or new.version_no is distinct from old.version_no
      or new.section_schema is distinct from old.section_schema
      or new.required_fields is distinct from old.required_fields
      or new.display_rules is distinct from old.display_rules
      or new.created_by is distinct from old.created_by
      or new.approved_by is distinct from old.approved_by
      or new.published_at is distinct from old.published_at
      or new.effective_from is distinct from old.effective_from) then
    raise exception 'published document template semantics are immutable' using errcode = '23514';
  end if;
  if old.status = 'RETIRED' then
    raise exception 'retired document template versions are immutable' using errcode = '23514';
  end if;
  return new;
end
$body$;

create trigger clinical_document_template_version_immutable
before update or delete on clinical_document_template_version
for each row execute function protect_document_template_version();

-- Upgrade-safe baseline: every historical document type receives one published system template.
insert into clinical_document_template(
  tenant_id, template_id, template_code, display_name, document_type_code, created_by)
select document.tenant_id,
  md5(document.tenant_id::text || '|document-template|' || document.document_type_code)::uuid,
  'BASELINE.' || substr(md5(document.document_type_code), 1, 20),
  document.document_type_code || ' 历史基线模板', document.document_type_code,
  min(document.created_by::text)::uuid
from clinical_document document
group by document.tenant_id, document.document_type_code;

insert into clinical_document_template_version(
  tenant_id, template_id, template_version_id, version_no, status, section_schema,
  required_fields, display_rules, effective_from, created_by, approved_by, published_at)
select template.tenant_id, template.template_id,
  md5(template.template_id::text || '|version|1')::uuid, 1, 'PUBLISHED',
  jsonb_build_object('type', 'object', 'additionalProperties', true), '{}',
  jsonb_build_object('legacy_baseline', true), '-infinity'::timestamptz,
  template.created_by,
  coalesce((select account.user_id from app_user account
    where account.tenant_id = template.tenant_id and account.user_id <> template.created_by
    order by account.user_id limit 1), template.created_by),
  now()
from clinical_document_template template;

alter table clinical_document add column template_version_id uuid;

update clinical_document document
set template_version_id = version.template_version_id
from clinical_document_template template
join clinical_document_template_version version
  on version.tenant_id = template.tenant_id and version.template_id = template.template_id
where template.tenant_id = document.tenant_id
  and template.document_type_code = document.document_type_code
  and version.status = 'PUBLISHED';

set constraints all immediate;

alter table clinical_document alter column template_version_id set not null;

alter table clinical_document
  add constraint clinical_document_template_version_fk
  foreign key (tenant_id, template_version_id)
  references clinical_document_template_version(tenant_id, template_version_id);
