do $$
begin
  if exists (
    select 1 from clinical_document_template_version version
    where (version.display_rules ->> 'legacy_baseline')::boolean is true
      and (
        version.template_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        or version.template_version_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      )
  ) then
    raise exception 'V32 legacy template UUID normalization failed';
  end if;
  if exists (select 1 from clinical_document where template_version_id is null) then
    raise exception 'V32 document template linkage was lost';
  end if;
end $$;

