do $schema_assert$
declare
  required_table text;
begin
  foreach required_table in array array[
    'outbox_consumer_receipt', 'clinical_event_projection', 'outbox_replay_audit'
  ] loop
    if to_regclass(required_table) is null then
      raise exception 'missing outbox dispatch table: %', required_table;
    end if;
  end loop;

  if not exists (
    select 1 from information_schema.columns
    where table_name = 'outbox_event' and column_name = 'fencing_token'
  ) then
    raise exception 'outbox fencing_token is missing';
  end if;
end
$schema_assert$;

insert into outbox_event(
  tenant_id, event_id, aggregate_type, aggregate_id, aggregate_version,
  event_type, schema_version, payload
) values (
  '00000000-0000-7000-8000-000000000001',
  '00000000-0000-7000-8000-000000000701',
  'SCHEMA_ASSERTION', '00000000-0000-7000-8000-000000000702', 1,
  'SchemaAssertionCreated', 1, '{"safe":"synthetic"}'
);

do $constraint_assert$
begin
  begin
    update outbox_event
    set dispatch_state = 'PUBLISHED'
    where event_id = '00000000-0000-7000-8000-000000000701';
    raise exception 'published state without published_at was accepted';
  exception when check_violation then
    null;
  end;
end
$constraint_assert$;
