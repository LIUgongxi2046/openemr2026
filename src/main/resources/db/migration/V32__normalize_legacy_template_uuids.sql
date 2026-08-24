-- PostgreSQL accepts any 128-bit value as uuid, while browser/API validators
-- correctly require RFC 4122 version and variant bits. V30 used raw MD5 bits
-- for upgrade-only baseline identifiers, so normalize only those baselines.
create temporary table legacy_template_uuid_map on commit drop as
select version.tenant_id,
  version.template_id as old_template_id,
  version.template_version_id as old_template_version_id,
  gen_random_uuid() as new_template_id,
  gen_random_uuid() as new_template_version_id
from clinical_document_template_version version
where (version.display_rules ->> 'legacy_baseline')::boolean is true
  and (
    version.template_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or version.template_version_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  );

alter table clinical_document drop constraint clinical_document_template_version_fk;
alter table clinical_document_template_version
  drop constraint clinical_document_template_version_tenant_id_template_id_fkey;
alter table clinical_document_template_version disable trigger clinical_document_template_version_immutable;

update clinical_document document
set template_version_id = mapping.new_template_version_id
from legacy_template_uuid_map mapping
where mapping.tenant_id = document.tenant_id
  and mapping.old_template_version_id = document.template_version_id;

update clinical_document_template_version version
set template_id = mapping.new_template_id,
  template_version_id = mapping.new_template_version_id
from legacy_template_uuid_map mapping
where mapping.tenant_id = version.tenant_id
  and mapping.old_template_id = version.template_id
  and mapping.old_template_version_id = version.template_version_id;

update clinical_document_template template
set template_id = mapping.new_template_id
from legacy_template_uuid_map mapping
where mapping.tenant_id = template.tenant_id
  and mapping.old_template_id = template.template_id;

alter table clinical_document_template_version enable trigger clinical_document_template_version_immutable;
alter table clinical_document_template_version
  add constraint clinical_document_template_version_tenant_id_template_id_fkey
  foreign key (tenant_id, template_id)
  references clinical_document_template(tenant_id, template_id);
alter table clinical_document
  add constraint clinical_document_template_version_fk
  foreign key (tenant_id, template_version_id)
  references clinical_document_template_version(tenant_id, template_version_id);

