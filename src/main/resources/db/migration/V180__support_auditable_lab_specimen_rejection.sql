do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  where rel.relname = 'lab_specimen'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) like '%collected_at%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table lab_specimen drop constraint %I', constraint_name);
  end if;
end $$;

alter table lab_specimen
  add constraint lab_specimen_collection_evidence_check
  check (
    (collection_status in ('COLLECTED', 'RECEIVED') and collected_at is not null)
    or (collection_status = 'ORDERED' and collected_at is null)
    or collection_status = 'REJECTED'
  );

comment on constraint lab_specimen_collection_evidence_check on lab_specimen is
  'Rejected specimens retain any prior collection evidence; rejection_reason records the correction rationale.';
