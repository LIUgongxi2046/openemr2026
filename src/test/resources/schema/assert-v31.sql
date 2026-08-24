do $$
begin
  if to_regclass('clinical_document_attachment') is null
      or to_regclass('clinical_document_source_reference') is null then
    raise exception 'V31 document attachment/source tables missing';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'clinical_document_attachment_immutable')
      or not exists (select 1 from pg_trigger where tgname = 'clinical_document_source_reference_immutable') then
    raise exception 'V31 immutable evidence triggers missing';
  end if;
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = current_schema() and table_name = 'clinical_document_attachment'
      and constraint_type = 'FOREIGN KEY'
  ) then
    raise exception 'V31 attachment-to-document evidence foreign key missing';
  end if;
end $$;
