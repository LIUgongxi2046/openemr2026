do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = current_schema() and table_name = 'document_quality_run'
  ) then
    raise exception 'V21 document_quality_run missing';
  end if;
  if not exists (select 1 from pg_indexes where indexname = 'document_quality_run_latest_idx') then
    raise exception 'V21 document quality latest-run index missing';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'document_quality_run_immutable') then
    raise exception 'V21 document quality run immutability trigger missing';
  end if;
  begin
    insert into document_quality_run(
      tenant_id, quality_run_id, document_id, document_version_id, rule_version,
      outcome, finding_count, blocking_count, warning_count, content_hash, executed_by)
    values (
      '018f0000-0000-7000-8000-000000000001',
      '018f0000-0000-7000-8000-000000000002',
      '018f0000-0000-7000-8000-000000000003',
      '018f0000-0000-7000-8000-000000000004',
      'contract-test', 'PASSED', 1, 0, 1,
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      '018f0000-0000-7000-8000-000000000005');
    raise exception 'V21 accepted an inconsistent quality outcome';
  exception when check_violation or foreign_key_violation then
    null;
  end;
end $$;
