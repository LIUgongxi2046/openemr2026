do $$
declare
  required_table text;
  required_trigger text;
begin
  foreach required_table in array array[
    'archive_case', 'archive_case_item', 'archive_case_event', 'archive_export_package'
  ] loop
    if not exists (
      select 1 from information_schema.tables
      where table_schema = current_schema() and table_name = required_table
    ) then
      raise exception 'V22 table % missing', required_table;
    end if;
  end loop;

  foreach required_trigger in array array[
    'archive_case_protected', 'archive_case_item_immutable',
    'archive_case_event_immutable', 'archive_export_package_immutable'
  ] loop
    if not exists (select 1 from pg_trigger where tgname = required_trigger) then
      raise exception 'V22 trigger % missing', required_trigger;
    end if;
  end loop;

  if not exists (select 1 from pg_indexes where indexname = 'archive_case_event_timeline_idx') then
    raise exception 'V22 archive event timeline index missing';
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_definition
    join pg_class constrained_table on constrained_table.oid = constraint_definition.conrelid
    join pg_namespace constrained_schema on constrained_schema.oid = constrained_table.relnamespace
    where constrained_schema.nspname = current_schema()
      and constrained_table.relname = 'archive_export_package'
      and constraint_definition.contype = 'c'
      and pg_get_constraintdef(constraint_definition.oid) ilike '%content_text IS JSON%'
  ) then
    raise exception 'V22 archive export JSON constraint missing';
  end if;
end $$;
