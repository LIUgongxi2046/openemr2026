do $$
begin
  if to_regclass('nursing_bedside_note') is null then
    raise exception 'V91 nursing_bedside_note table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'nursing_bedside_note_immutable'
  ) then
    raise exception 'V91 nursing bedside note immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'nursing_bedside_note_patient_idx'
  ) then
    raise exception 'V91 nursing bedside note index missing';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'nursing_bedside_note'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%recorded_at <= synced_at%'
  ) then
    raise exception 'V91 nursing bedside note dual-timestamp ordering constraint missing';
  end if;
end $$;
