create unique index quality_finding_rule_version_uk
  on quality_finding (tenant_id, document_version_id, rule_code, rule_version);

create or replace function protect_signed_document_version()
returns trigger
language plpgsql
as $protect$
begin
  if tg_op = 'DELETE' and old.status = 'SIGNED' then
    raise exception 'signed clinical document versions are immutable' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and old.status = 'SIGNED' then
    raise exception 'signed clinical document versions are immutable' using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end
$protect$;

create trigger clinical_document_version_signed_immutable
before update or delete on clinical_document_version
for each row execute function protect_signed_document_version();
