do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = current_schema() and table_name = 'document_signature_policy'
  ) then
    raise exception 'V12 document_signature_policy missing';
  end if;
  begin
    insert into document_signature_policy(
      tenant_id, document_id, document_version_id, required_signature_level,
      current_signature_level, review_status)
    values (
      '018f0000-0000-7000-8000-000000000001',
      '018f0000-0000-7000-8000-000000000002',
      '018f0000-0000-7000-8000-000000000003',
      'ATTENDING', 'AUTHOR', 'COMPLETED');
    raise exception 'V12 accepted incomplete signature policy';
  exception when check_violation or foreign_key_violation then
    null;
  end;
end $$;
