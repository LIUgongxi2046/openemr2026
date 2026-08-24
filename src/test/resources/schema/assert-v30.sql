do $$
begin
  if to_regclass('clinical_document_template') is null
      or to_regclass('clinical_document_template_version') is null then
    raise exception 'V30 document template tables missing';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'clinical_document_template_version_immutable') then
    raise exception 'V30 immutable published template trigger missing';
  end if;
  if exists (select 1 from clinical_document where template_version_id is null) then
    raise exception 'V30 historical document template linkage missing';
  end if;
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = current_schema() and table_name = 'clinical_document'
      and constraint_name = 'clinical_document_template_version_fk'
  ) then
    raise exception 'V30 document-template foreign key missing';
  end if;
end $$;
