do $$
begin
  if to_regclass('dental_followup_record') is null then
    raise exception 'V144 dental_followup_record table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'dental_followup_immutable'
  ) then
    raise exception 'V144 dental followup immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'dental_followup_patient_idx'
  ) then
    raise exception 'V144 dental followup index missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'dental_followup_no_show_check'
  ) then
    raise exception 'V144 dental followup no-show constraint missing';
  end if;
end $$;
